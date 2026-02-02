import { Server, Socket } from 'socket.io';
import { roomStore } from '../store/roomStore';
import { roomService } from '../services/roomService';
import { Template, Phase, PostIt, Room, ActionItem, ParticipantRole } from '../../../shared/types';
import bcrypt from 'bcryptjs';

export const setupSocketHandlers = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        const isAuthenticated = !socket.isGuest && socket.user;
        console.log(`User connected: ${socket.id} (${isAuthenticated ? 'authenticated: ' + socket.user?.email : 'guest'})`);

        // Create room - authenticated users only
        socket.on('room:create', async (data: { 
            name: string, 
            template: string, 
            facilitatorName: string,
            password?: string,
            maxPostitsPerUser?: number 
        }, callback: (response: any) => void) => {
            try {
                const { name, template, facilitatorName, password, maxPostitsPerUser } = data;

                // Only authenticated users can create rooms
                if (!isAuthenticated) {
                    return callback({ success: false, error: 'You must be logged in to create a room' });
                }

                // Create room metadata in PostgreSQL first to get the IDs
                let dbRoomId: string | undefined;
                let dbParticipantId: string | undefined;
                try {
                    const dbResult = await roomService.createRoom(
                        socket.user!.userId,
                        name,
                        template as Template,
                        password,
                        maxPostitsPerUser
                    );
                    dbRoomId = dbResult.roomId;
                    dbParticipantId = dbResult.participantId;
                } catch (dbError) {
                    console.error('Failed to save room to database:', dbError);
                    // Continue anyway - we'll generate new IDs
                }

                // Create room in Redis (use PostgreSQL IDs if available)
                const room = await roomStore.createRoom({
                    name,
                    template: template as Template,
                    facilitatorName,
                    ownerId: socket.user!.userId,
                    password,
                    maxPostitsPerUser,
                    roomId: dbRoomId,
                    participantId: dbParticipantId,
                });

                console.log(`Room created: ${room.id} by ${facilitatorName}`);

                socket.join(room.id);
                roomStore.registerSocket(socket.id, room.id, room.facilitatorId);

                callback({ success: true, room, odlUserId: room.facilitatorId });
            } catch (error) {
                console.error('Error creating room:', error);
                callback({ success: false, error: 'Failed to create room' });
            }
        });

        // Join room - guests and authenticated users
        socket.on('room:join', async (data: { 
            roomId: string, 
            participantName: string,
            password?: string,
            role?: ParticipantRole 
        }, callback: (response: any) => void) => {
            try {
                const { roomId, participantName, password, role } = data;

                let room = await roomStore.getRoom(roomId);
                
                // If room not in Redis, try to restore from PostgreSQL
                if (!room) {
                    const metadata = await roomService.getRoomMetadata(roomId);
                    if (metadata) {
                        room = await roomStore.restoreRoomFromMetadata({
                            id: metadata.id,
                            name: metadata.name,
                            template: metadata.template,
                            phase: metadata.phase,
                            status: metadata.status,
                            passwordHash: metadata.passwordHash,
                            maxPostitsPerUser: metadata.maxPostitsPerUser,
                            ownerId: metadata.ownerId,
                            participants: metadata.participants.map(p => ({
                                id: p.id,
                                userId: p.userId,
                                guestName: p.guestName || p.user?.name || null,
                                role: p.role,
                            })),
                        });
                        console.log(`Room ${roomId} restored from database`);
                    }
                }
                
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }

                // Check password if room is protected
                if (room.hasPassword) {
                    // Get password hash from database
                    const hasValidPassword = await roomService.verifyRoomPassword(roomId, password || '');
                    if (!hasValidPassword) {
                        return callback({ success: false, error: 'Invalid password', requiresPassword: true });
                    }
                }

                // Determine role (default to PARTICIPANT, only facilitator can assign OBSERVER)
                const participantRole: ParticipantRole = role === 'OBSERVER' ? 'OBSERVER' : 'PARTICIPANT';

                const participant = await roomStore.addParticipant(
                    roomId, 
                    participantName, 
                    participantRole,
                    isAuthenticated ? socket.user!.userId : undefined
                );

                if (!participant) {
                    return callback({ success: false, error: 'Could not join room' });
                }

                socket.join(roomId);
                roomStore.registerSocket(socket.id, roomId, participant.id);

                // Notify others
                socket.to(roomId).emit('participant:joined', participant);

                const updatedRoom = await roomStore.getRoom(roomId);
                callback({ success: true, room: updatedRoom, odlUserId: participant.id });
                console.log(`${participantName} joined room ${roomId} as ${participantRole}`);
            } catch (error) {
                console.error('Error joining room:', error);
                callback({ success: false, error: 'Failed to join room' });
            }
        });

        // Rejoin room for existing participant (reconnection)
        socket.on('room:rejoin', async (data: { roomId: string, participantId: string }, callback: (response: any) => void) => {
            try {
                const { roomId, participantId } = data;

                let room = await roomStore.getRoom(roomId);
                
                // If room not in Redis, try to restore from PostgreSQL
                if (!room) {
                    const metadata = await roomService.getRoomMetadata(roomId);
                    if (metadata) {
                        room = await roomStore.restoreRoomFromMetadata({
                            id: metadata.id,
                            name: metadata.name,
                            template: metadata.template,
                            phase: metadata.phase,
                            status: metadata.status,
                            passwordHash: metadata.passwordHash,
                            maxPostitsPerUser: metadata.maxPostitsPerUser,
                            ownerId: metadata.ownerId,
                            participants: metadata.participants.map(p => ({
                                id: p.id,
                                userId: p.userId,
                                guestName: p.guestName || p.user?.name || null,
                                role: p.role,
                            })),
                        });
                        console.log(`Room ${roomId} restored from database for rejoin`);
                    }
                }
                
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }

                const participant = await roomStore.getParticipant(roomId, participantId);
                if (!participant) {
                    return callback({ success: false, error: 'Participant not found in room' });
                }

                // Set participant online
                await roomStore.setParticipantOnline(roomId, participantId, true);

                socket.join(roomId);
                roomStore.registerSocket(socket.id, roomId, participantId);

                // Notify others of status change
                const updatedRoom = await roomStore.getRoom(roomId);
                socket.to(roomId).emit('participant:status', { participantId, isOnline: true });
                socket.to(roomId).emit('room:updated', updatedRoom);

                callback({ success: true, room: updatedRoom, odlUserId: participantId });
                console.log(`${participant.name} rejoined room ${roomId}`);
            } catch (error) {
                console.error('Error rejoining room:', error);
                callback({ success: false, error: 'Failed to rejoin room' });
            }
        });

        // Check if room requires password
        socket.on('room:check', async (data: { roomId: string }, callback: (response: any) => void) => {
            try {
                let room = await roomStore.getRoom(data.roomId);
                
                // If not in Redis, check PostgreSQL
                if (!room) {
                    const metadata = await roomService.getRoomMetadata(data.roomId);
                    if (metadata) {
                        return callback({ 
                            success: true, 
                            roomName: metadata.name,
                            requiresPassword: !!metadata.passwordHash,
                            status: metadata.status
                        });
                    }
                    return callback({ success: false, error: 'Room not found' });
                }

                callback({ 
                    success: true, 
                    roomName: room.name,
                    requiresPassword: room.hasPassword,
                    status: room.status
                });
            } catch (error) {
                callback({ success: false, error: 'Failed to check room' });
            }
        });

        // Delete room (facilitator only)
        socket.on('room:delete', async (data: { roomId: string, odlUserId: string }, callback: (response: any) => void) => {
            try {
                const { roomId, odlUserId } = data;

                const room = await roomStore.getRoom(roomId);
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }

                // Check if user is facilitator
                const participant = await roomStore.getParticipant(roomId, odlUserId);
                if (!participant || participant.role !== 'FACILITATOR') {
                    return callback({ success: false, error: 'Only the facilitator can delete the room' });
                }

                // Notify all participants before deletion
                io.to(roomId).emit('room:deleted', { roomId });

                // Delete the room
                await roomStore.deleteRoom(roomId);

                // Also delete from database
                try {
                    await roomService.deleteRoom(roomId);
                } catch (e) {
                    // Ignore DB errors
                }

                callback({ success: true });
                console.log(`Room ${roomId} deleted by facilitator`);
            } catch (error) {
                console.error('Error deleting room:', error);
                callback({ success: false, error: 'Failed to delete room' });
            }
        });

        // Close room (archive it)
        socket.on('room:close', async (data: { roomId: string, odlUserId: string }, callback: (response: any) => void) => {
            try {
                const { roomId, odlUserId } = data;

                const room = await roomStore.getRoom(roomId);
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }

                const participant = await roomStore.getParticipant(roomId, odlUserId);
                if (!participant || participant.role !== 'FACILITATOR') {
                    return callback({ success: false, error: 'Only the facilitator can close the room' });
                }

                await roomStore.updateRoomStatus(roomId, 'CLOSED');

                // Update database
                try {
                    await roomService.updateRoomStatus(roomId, 'CLOSED');
                } catch (e) {
                    // Ignore DB errors
                }

                const updatedRoom = await roomStore.getRoom(roomId);
                io.to(roomId).emit('room:updated', updatedRoom);

                callback({ success: true });
                console.log(`Room ${roomId} closed`);
            } catch (error) {
                console.error('Error closing room:', error);
                callback({ success: false, error: 'Failed to close room' });
            }
        });

        // Reopen room
        socket.on('room:reopen', async (data: { roomId: string, odlUserId: string }, callback: (response: any) => void) => {
            try {
                const { roomId, odlUserId } = data;

                const room = await roomStore.getRoom(roomId);
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }

                const participant = await roomStore.getParticipant(roomId, odlUserId);
                if (!participant || participant.role !== 'FACILITATOR') {
                    return callback({ success: false, error: 'Only the facilitator can reopen the room' });
                }

                await roomStore.updateRoomStatus(roomId, 'ACTIVE');

                try {
                    await roomService.updateRoomStatus(roomId, 'ACTIVE');
                } catch (e) {
                    // Ignore DB errors
                }

                const updatedRoom = await roomStore.getRoom(roomId);
                io.to(roomId).emit('room:updated', updatedRoom);

                callback({ success: true, room: updatedRoom });
                console.log(`Room ${roomId} reopened`);
            } catch (error) {
                console.error('Error reopening room:', error);
                callback({ success: false, error: 'Failed to reopen room' });
            }
        });

        // Change participant role (facilitator only)
        socket.on('participant:role', async (data: { roomId: string, participantId: string, role: ParticipantRole, odlUserId: string }, callback: (response: any) => void) => {
            try {
                const { roomId, participantId, role, odlUserId } = data;

                const room = await roomStore.getRoom(roomId);
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }

                const requester = await roomStore.getParticipant(roomId, odlUserId);
                if (!requester || requester.role !== 'FACILITATOR') {
                    return callback({ success: false, error: 'Only the facilitator can change roles' });
                }

                // Can't change facilitator's own role
                if (participantId === odlUserId) {
                    return callback({ success: false, error: 'Cannot change your own role' });
                }

                await roomStore.setParticipantRole(roomId, participantId, role);

                const updatedRoom = await roomStore.getRoom(roomId);
                io.to(roomId).emit('room:updated', updatedRoom);

                callback({ success: true });
            } catch (error) {
                console.error('Error changing role:', error);
                callback({ success: false, error: 'Failed to change role' });
            }
        });

        // Phase change (facilitator only)
        socket.on('phase:change', async (data: { roomId: string, phase: Phase, odlUserId?: string }) => {
            const { roomId, phase, odlUserId } = data;

            // Check if user is facilitator
            if (odlUserId) {
                const participant = await roomStore.getParticipant(roomId, odlUserId);
                if (!participant || participant.role !== 'FACILITATOR') {
                    return; // Silently ignore non-facilitator requests
                }
            }

            if (await roomStore.updatePhase(roomId, phase)) {
                // Update database
                try {
                    await roomService.updateRoomPhase(roomId, phase);
                } catch (e) {
                    // Ignore DB errors
                }

                // When entering ACTIONS phase, auto-focus on the top voted group
                if (phase === 'ACTIONS') {
                    await roomStore.focusTopVotedGroup(roomId);
                }

                io.to(roomId).emit('room:updated', await roomStore.getRoom(roomId));
                console.log(`Phase changed to ${phase} in room ${roomId}`);
            }
        });

        socket.on('timer:start', async (data: { roomId: string, duration: number }) => {
            await roomStore.startTimer(data.roomId, data.duration, (room: Room) => {
                io.to(data.roomId).emit('room:updated', room);
            });
        });

        socket.on('timer:stop', async (data: { roomId: string }) => {
            if (await roomStore.stopTimer(data.roomId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        // Create post-it (check role and limit)
        socket.on('postit:create', async (data: { 
            roomId: string, 
            content: string, 
            columnId: string, 
            authorId: string, 
            authorName: string, 
            color: string 
        }) => {
            const { roomId, content, columnId, authorId, authorName, color } = data;

            // Check if user can create post-it
            const canCreate = await roomStore.canCreatePostIt(roomId, authorId);
            if (!canCreate.allowed) {
                socket.emit('error', { message: canCreate.reason });
                return;
            }

            const postit = await roomStore.addPostIt(roomId, { content, columnId, authorId, authorName, color });
            if (postit) {
                io.to(roomId).emit('postit:created', postit);
            }
        });

        socket.on('postit:move', async (data: { roomId: string, postitId: string, columnId: string }) => {
            const postit = await roomStore.updatePosition(data.roomId, data.postitId, data.columnId);
            if (postit) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('postit:update', async (data: { roomId: string, postitId: string, content: string }) => {
            const postit = await roomStore.updatePostIt(data.roomId, data.postitId, data.content);
            if (postit) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('postit:vote', async (data: { roomId: string, postitId: string, odlUserId: string }) => {
            const { roomId, postitId, odlUserId } = data;

            // Check if user is observer
            const participant = await roomStore.getParticipant(roomId, odlUserId);
            if (participant?.role === 'OBSERVER') {
                socket.emit('error', { message: 'Observers cannot vote' });
                return;
            }

            const room = await roomStore.getRoom(roomId);
            if (!room) return;

            const postit = room.postits.find((p: PostIt) => p.id === postitId);
            if (postit) {
                const voteIndex = postit.votes.indexOf(odlUserId);
                if (voteIndex > -1) {
                    postit.votes.splice(voteIndex, 1);
                } else {
                    postit.votes.push(odlUserId);
                }
                await roomStore.saveRoom(room);
                io.to(roomId).emit('room:updated', room);
            }
        });

        socket.on('postit:focus', async (data: { roomId: string, postitId: string | null }) => {
            if (await roomStore.setFocus(data.roomId, data.postitId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('group:create', async (data: { roomId: string, title: string, color?: string }) => {
            if (await roomStore.addGroup(data.roomId, data.title, data.color)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('group:update', async (data: { roomId: string, groupId: string, title: string }) => {
            if (await roomStore.updateGroup(data.roomId, data.groupId, data.title)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('group:delete', async (data: { roomId: string, groupId: string }) => {
            if (await roomStore.deleteGroup(data.roomId, data.groupId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('postit:group', async (data: { roomId: string, postitId: string, groupId: string | null }) => {
            if (await roomStore.assignPostItToGroup(data.roomId, data.postitId, data.groupId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('action:create', async (data: { roomId: string, content: string, ownerName?: string, groupId?: string }) => {
            if (await roomStore.addActionItem(data.roomId, data.content, data.ownerName, data.groupId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('action:update', async (data: { roomId: string, actionId: string, updates: Partial<ActionItem> }) => {
            if (await roomStore.updateActionItem(data.roomId, data.actionId, data.updates)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('action:delete', async (data: { roomId: string, actionId: string }) => {
            if (await roomStore.deleteActionItem(data.roomId, data.actionId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('group:vote', async (data: { roomId: string, groupId: string, odlUserId: string }) => {
            // Check if user is observer
            const participant = await roomStore.getParticipant(data.roomId, data.odlUserId);
            if (participant?.role === 'OBSERVER') {
                socket.emit('error', { message: 'Observers cannot vote' });
                return;
            }

            if (await roomStore.castGroupVote(data.roomId, data.groupId, data.odlUserId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('group:unvote', async (data: { roomId: string, groupId: string, odlUserId: string }) => {
            if (await roomStore.retractGroupVote(data.roomId, data.groupId, data.odlUserId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        socket.on('vote:reset_tie', async (data: { roomId: string }) => {
            if (await roomStore.resetTieVotes(data.roomId)) {
                io.to(data.roomId).emit('room:updated', await roomStore.getRoom(data.roomId));
            }
        });

        // Focus on a specific group (facilitator only, for ACTIONS phase)
        socket.on('group:focus', async (data: { roomId: string, groupId: string, odlUserId: string }) => {
            const { roomId, groupId, odlUserId } = data;

            const participant = await roomStore.getParticipant(roomId, odlUserId);
            if (!participant || participant.role !== 'FACILITATOR') {
                socket.emit('error', { message: 'Only the facilitator can focus on groups' });
                return;
            }

            if (await roomStore.focusGroup(roomId, groupId)) {
                io.to(roomId).emit('room:updated', await roomStore.getRoom(roomId));
                console.log(`Group ${groupId} focused in room ${roomId}`);
            }
        });

        // Mark a group as complete and move to next (facilitator only)
        socket.on('group:complete', async (data: { roomId: string, groupId: string, odlUserId: string }) => {
            const { roomId, groupId, odlUserId } = data;

            const participant = await roomStore.getParticipant(roomId, odlUserId);
            if (!participant || participant.role !== 'FACILITATOR') {
                socket.emit('error', { message: 'Only the facilitator can complete groups' });
                return;
            }

            if (await roomStore.completeGroupAndFocusNext(roomId, groupId)) {
                io.to(roomId).emit('room:updated', await roomStore.getRoom(roomId));
                console.log(`Group ${groupId} completed in room ${roomId}`);
            }
        });

        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.id);
            
            const mapping = roomStore.unregisterSocket(socket.id);
            if (mapping) {
                const { roomId, participantId } = mapping;
                await roomStore.setParticipantOnline(roomId, participantId, false);
                
                const room = await roomStore.getRoom(roomId);
                if (room) {
                    io.to(roomId).emit('participant:status', { participantId, isOnline: false });
                    io.to(roomId).emit('room:updated', room);
                }
            }
        });
    });
};
