import { Room, Phase, Template, PostIt, Participant, Column, Group, ActionItem, ParticipantRole, RoomStatus, GroupStatus } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import redis from './redisClient';

// In-memory cache for active timers (intervals can't be stored in Redis)
const activeTimers: Map<string, NodeJS.Timeout> = new Map();

// Mapping socket.id -> { roomId, participantId }
const socketToUser: Map<string, { roomId: string; participantId: string }> = new Map();

interface CreateRoomOptions {
    name: string;
    template: Template;
    facilitatorName: string;
    ownerId?: string;
    password?: string;
    maxPostitsPerUser?: number;
}

class RoomStore {
    private getRoomKey(roomId: string): string {
        return `room:${roomId}`;
    }

    async createRoom(options: CreateRoomOptions & { roomId?: string; participantId?: string }): Promise<Room> {
        const { name, template, facilitatorName, ownerId, password, maxPostitsPerUser, roomId, participantId } = options;
        const id = roomId || uuidv4();
        const facilitatorId = participantId || uuidv4();

        const columns: Column[] = this.getDefaultColumns(template);

        const room: Room = {
            id,
            name,
            template,
            columns,
            groups: [],
            phase: 'SETUP',
            facilitatorId,
            status: 'ACTIVE',
            hasPassword: !!password,
            maxPostitsPerUser,
            ownerId,
            timer: null,
            participants: [{
                id: facilitatorId,
                name: facilitatorName,
                role: 'FACILITATOR',
                isOnline: true,
                isGuest: !ownerId,
                userId: ownerId,
            }],
            postits: [],
            focusedPostItId: null,
            focusedGroupId: null,
            actionItems: [],
            createdAt: Date.now()
        };

        await redis.set(this.getRoomKey(id), JSON.stringify(room));
        await redis.sadd('rooms:index', id);

        return room;
    }

    async getRoom(id: string): Promise<Room | null> {
        const data = await redis.get(this.getRoomKey(id));
        if (!data) return null;
        const room = JSON.parse(data) as Room;
        
        // Ensure backward compatibility - add default values for new fields
        if (!room.focusedGroupId) room.focusedGroupId = null;
        
        // Ensure groups have status field
        room.groups = room.groups.map(g => ({
            ...g,
            status: g.status || 'PENDING'
        }));
        if (!room.status) room.status = 'ACTIVE';
        room.participants = room.participants.map(p => ({
            ...p,
            role: p.role || (p.id === room.facilitatorId ? 'FACILITATOR' : 'PARTICIPANT'),
        }));
        
        return room;
    }

    async saveRoom(room: Room): Promise<void> {
        // Remove intervalId before saving (not serializable)
        const roomToSave = { ...room };
        if (roomToSave.timer) {
            roomToSave.timer = { ...roomToSave.timer };
            delete roomToSave.timer.intervalId;
        }
        await redis.set(this.getRoomKey(room.id), JSON.stringify(roomToSave));
    }

    // Restore a room from database metadata (when Redis data is lost)
    async restoreRoomFromMetadata(metadata: {
        id: string;
        name: string;
        template: string;
        phase: string;
        status: string;
        passwordHash: string | null;
        maxPostitsPerUser: number | null;
        ownerId: string;
        participants: Array<{
            id: string;
            userId: string | null;
            guestName: string | null;
            role: string;
        }>;
    }): Promise<Room> {
        const columns: Column[] = this.getDefaultColumns(metadata.template as Template);

        // Find facilitator
        const facilitator = metadata.participants.find(p => p.role === 'FACILITATOR');
        const facilitatorId = facilitator?.id || metadata.participants[0]?.id || metadata.ownerId;

        const room: Room = {
            id: metadata.id,
            name: metadata.name,
            template: metadata.template as Template,
            columns,
            groups: [],
            phase: metadata.phase as Phase,
            facilitatorId,
            status: metadata.status as RoomStatus,
            hasPassword: !!metadata.passwordHash,
            maxPostitsPerUser: metadata.maxPostitsPerUser || undefined,
            ownerId: metadata.ownerId,
            timer: null,
            participants: metadata.participants.map(p => ({
                id: p.id,
                name: p.guestName || 'User',
                role: p.role as ParticipantRole,
                isOnline: false,
                isGuest: !p.userId,
                userId: p.userId || undefined,
            })),
            postits: [],
            focusedPostItId: null,
            focusedGroupId: null,
            actionItems: [],
            createdAt: Date.now()
        };

        await redis.set(this.getRoomKey(metadata.id), JSON.stringify(room));
        await redis.sadd('rooms:index', metadata.id);

        return room;
    }

    async deleteRoom(roomId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        // Stop any active timer
        this.stopTimer(roomId);

        // Remove from Redis
        await redis.del(this.getRoomKey(roomId));
        await redis.srem('rooms:index', roomId);

        // Clear socket mappings for this room
        for (const [socketId, data] of socketToUser.entries()) {
            if (data.roomId === roomId) {
                socketToUser.delete(socketId);
            }
        }

        return true;
    }

    async addParticipant(
        roomId: string, 
        name: string, 
        role: ParticipantRole = 'PARTICIPANT',
        userId?: string
    ): Promise<Participant | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        // Check if user is already a participant
        if (userId) {
            const existing = room.participants.find(p => p.userId === userId);
            if (existing) {
                existing.isOnline = true;
                await this.saveRoom(room);
                return existing;
            }
        }

        const participant: Participant = {
            id: uuidv4(),
            name,
            role,
            isOnline: true,
            isGuest: !userId,
            userId,
        };

        room.participants.push(participant);
        await this.saveRoom(room);
        return participant;
    }

    async getParticipant(roomId: string, participantId: string): Promise<Participant | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        return room.participants.find(p => p.id === participantId) || null;
    }

    async getParticipantByUserId(roomId: string, userId: string): Promise<Participant | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        return room.participants.find(p => p.userId === userId) || null;
    }

    async setParticipantOnline(roomId: string, participantId: string, isOnline: boolean): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const participant = room.participants.find(p => p.id === participantId);
        if (!participant) return false;

        participant.isOnline = isOnline;
        await this.saveRoom(room);
        return true;
    }

    async setParticipantRole(roomId: string, participantId: string, role: ParticipantRole): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const participant = room.participants.find(p => p.id === participantId);
        if (!participant) return false;

        participant.role = role;
        await this.saveRoom(room);
        return true;
    }

    async updateRoomStatus(roomId: string, status: RoomStatus): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        room.status = status;
        if (status === 'CLOSED') {
            room.closedAt = Date.now();
        }
        await this.saveRoom(room);
        return true;
    }

    // Check if participant can perform action based on role
    canParticipantAct(participant: Participant, action: 'create_postit' | 'vote' | 'edit' | 'manage'): boolean {
        switch (action) {
            case 'create_postit':
            case 'vote':
                return participant.role !== 'OBSERVER';
            case 'edit':
                return participant.role === 'FACILITATOR' || participant.role === 'PARTICIPANT';
            case 'manage':
                return participant.role === 'FACILITATOR';
            default:
                return false;
        }
    }

    // Check post-it limit for a participant
    async canCreatePostIt(roomId: string, authorId: string): Promise<{ allowed: boolean; reason?: string }> {
        const room = await this.getRoom(roomId);
        if (!room) return { allowed: false, reason: 'Room not found' };

        const participant = room.participants.find(p => p.id === authorId);
        if (!participant) return { allowed: false, reason: 'Participant not found' };

        if (participant.role === 'OBSERVER') {
            return { allowed: false, reason: 'Observers cannot create post-its' };
        }

        if (room.maxPostitsPerUser) {
            const userPostits = room.postits.filter(p => p.authorId === authorId).length;
            if (userPostits >= room.maxPostitsPerUser) {
                return { allowed: false, reason: `Maximum ${room.maxPostitsPerUser} post-its per participant` };
            }
        }

        return { allowed: true };
    }

    // Socket mapping methods
    registerSocket(socketId: string, roomId: string, participantId: string): void {
        socketToUser.set(socketId, { roomId, participantId });
    }

    unregisterSocket(socketId: string): { roomId: string; participantId: string } | null {
        const data = socketToUser.get(socketId);
        if (data) {
            socketToUser.delete(socketId);
        }
        return data || null;
    }

    getSocketMapping(socketId: string): { roomId: string; participantId: string } | null {
        return socketToUser.get(socketId) || null;
    }

    async updatePhase(roomId: string, phase: Phase): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        // Auto-create groups for unclassified post-its when entering VOTING phase
        if (phase === 'VOTING') {
            const unassignedPostIts = room.postits.filter(p => !p.groupId);
            unassignedPostIts.forEach(p => {
                const group: Group = {
                    id: uuidv4(),
                    title: p.content,
                    color: p.color,
                    votes: [],
                    status: 'PENDING'
                };
                room.groups.push(group);
                p.groupId = group.id;
            });
        }

        // Reset group focus when leaving ACTIONS phase
        if (room.phase === 'ACTIONS' && phase !== 'ACTIONS') {
            room.focusedGroupId = null;
        }

        room.phase = phase;
        await this.saveRoom(room);
        return true;
    }

    // Focus on the top voted group (used when entering ACTIONS phase)
    async focusTopVotedGroup(roomId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room || room.groups.length === 0) return false;

        // Sort groups by votes (descending), then find first PENDING one
        const sortedGroups = [...room.groups].sort((a, b) => 
            (b.votes?.length || 0) - (a.votes?.length || 0)
        );

        const topGroup = sortedGroups.find(g => g.status !== 'DONE') || sortedGroups[0];
        
        // Set all groups to PENDING except the focused one
        room.groups.forEach(g => {
            if (g.id === topGroup.id) {
                g.status = 'ACTIVE';
            } else if (g.status === 'ACTIVE') {
                g.status = 'PENDING';
            }
        });

        room.focusedGroupId = topGroup.id;
        await this.saveRoom(room);
        return true;
    }

    // Focus on a specific group (facilitator action)
    async focusGroup(roomId: string, groupId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const group = room.groups.find(g => g.id === groupId);
        if (!group) return false;

        // Update statuses
        room.groups.forEach(g => {
            if (g.id === groupId) {
                g.status = 'ACTIVE';
            } else if (g.status === 'ACTIVE') {
                g.status = 'PENDING';
            }
        });

        room.focusedGroupId = groupId;
        await this.saveRoom(room);
        return true;
    }

    // Complete current group and move to next
    async completeGroupAndFocusNext(roomId: string, groupId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const group = room.groups.find(g => g.id === groupId);
        if (!group) return false;

        // Mark as done
        group.status = 'DONE';

        // Find next group to focus (sorted by votes, first PENDING)
        const sortedGroups = [...room.groups].sort((a, b) => 
            (b.votes?.length || 0) - (a.votes?.length || 0)
        );

        const nextGroup = sortedGroups.find(g => g.status === 'PENDING');
        
        if (nextGroup) {
            nextGroup.status = 'ACTIVE';
            room.focusedGroupId = nextGroup.id;
        } else {
            // All groups are done
            room.focusedGroupId = null;
        }

        await this.saveRoom(room);
        return true;
    }

    async startTimer(roomId: string, duration: number, onTick: (room: Room) => void): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        // Clear existing timer
        const existingTimer = activeTimers.get(roomId);
        if (existingTimer) {
            clearInterval(existingTimer);
            activeTimers.delete(roomId);
        }

        room.timer = {
            duration,
            remaining: duration,
            isRunning: true,
            startedAt: Date.now()
        };

        await this.saveRoom(room);

        // Create interval that updates room in Redis
        const intervalId = setInterval(async () => {
            const currentRoom = await this.getRoom(roomId);
            if (currentRoom && currentRoom.timer && currentRoom.timer.remaining > 0) {
                currentRoom.timer.remaining--;
                await this.saveRoom(currentRoom);
                onTick(currentRoom);
            } else if (currentRoom) {
                await this.stopTimer(roomId);
                onTick(currentRoom);
            }
        }, 1000);

        activeTimers.set(roomId, intervalId);
        return true;
    }

    async stopTimer(roomId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const existingTimer = activeTimers.get(roomId);
        if (existingTimer) {
            clearInterval(existingTimer);
            activeTimers.delete(roomId);
        }

        if (room.timer) {
            room.timer.isRunning = false;
            room.timer.remaining = 0;
            await this.saveRoom(room);
        }

        return true;
    }

    async setFocus(roomId: string, postitId: string | null): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;
        room.focusedPostItId = postitId;
        await this.saveRoom(room);
        return true;
    }

    async updatePosition(roomId: string, postitId: string, columnId: string): Promise<PostIt | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        const postit = room.postits.find(p => p.id === postitId);
        if (!postit) return null;

        postit.columnId = columnId;
        await this.saveRoom(room);
        return postit;
    }

    async updatePostIt(roomId: string, postitId: string, content: string): Promise<PostIt | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        const postit = room.postits.find(p => p.id === postitId);
        if (!postit) return null;

        postit.content = content;
        await this.saveRoom(room);
        return postit;
    }

    async addPostIt(roomId: string, postit: Omit<PostIt, 'id' | 'votes' | 'groupId' | 'position'>): Promise<PostIt | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        const newPostIt: PostIt = {
            ...postit,
            id: uuidv4(),
            votes: [],
            groupId: null,
            position: { x: 0, y: 0 }
        };

        room.postits.push(newPostIt);
        await this.saveRoom(room);
        return newPostIt;
    }

    async addActionItem(roomId: string, content: string, ownerName?: string, groupId?: string): Promise<ActionItem | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        const actionItem: ActionItem = {
            id: uuidv4(),
            content,
            ownerName,
            groupId,
            status: 'TODO'
        };
        room.actionItems.push(actionItem);
        await this.saveRoom(room);
        return actionItem;
    }

    async updateActionItem(roomId: string, actionId: string, updates: Partial<ActionItem>): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const actionItem = room.actionItems.find(a => a.id === actionId);
        if (!actionItem) return false;

        Object.assign(actionItem, updates);
        await this.saveRoom(room);
        return true;
    }

    async deleteActionItem(roomId: string, actionId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        room.actionItems = room.actionItems.filter(a => a.id !== actionId);
        await this.saveRoom(room);
        return true;
    }

    async addGroup(roomId: string, title: string, color: string = '#e0e0e0'): Promise<Group | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        const group: Group = {
            id: uuidv4(),
            title,
            color,
            votes: [],
            status: 'PENDING'
        };
        room.groups.push(group);
        await this.saveRoom(room);
        return group;
    }

    async updateGroup(roomId: string, groupId: string, title: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const group = room.groups.find(g => g.id === groupId);
        if (!group) return false;

        group.title = title;
        await this.saveRoom(room);
        return true;
    }

    async deleteGroup(roomId: string, groupId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        room.groups = room.groups.filter(g => g.id !== groupId);
        // Reset groupId for post-its in this group
        room.postits.forEach(p => {
            if (p.groupId === groupId) p.groupId = null;
        });
        await this.saveRoom(room);
        return true;
    }

    async assignPostItToGroup(roomId: string, postitId: string, groupId: string | null): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const postit = room.postits.find(p => p.id === postitId);
        if (!postit) return false;

        postit.groupId = groupId;
        await this.saveRoom(room);
        return true;
    }

    async castGroupVote(roomId: string, groupId: string, odlUserId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        // Check total votes for this user
        const totalUserVotes = room.groups.reduce((acc, g) =>
            acc + g.votes.filter(id => id === odlUserId).length, 0);

        if (totalUserVotes >= 3) return false;

        const group = room.groups.find(g => g.id === groupId);
        if (!group) return false;

        if (!group.votes) group.votes = [];
        group.votes.push(odlUserId);
        await this.saveRoom(room);
        return true;
    }

    async retractGroupVote(roomId: string, groupId: string, odlUserId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const group = room.groups.find(g => g.id === groupId);
        if (!group || !group.votes) return false;

        const index = group.votes.indexOf(odlUserId);
        if (index === -1) return false;

        group.votes.splice(index, 1);
        await this.saveRoom(room);
        return true;
    }

    async resetTieVotes(roomId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        // 1. Find the highest vote count
        let maxVotes = 0;
        room.groups.forEach(g => {
            if (g.votes && g.votes.length > maxVotes) {
                maxVotes = g.votes.length;
            }
        });

        if (maxVotes === 0) return false;

        // 2. Find all groups that have this max count
        const tiedGroups = room.groups.filter(g => (g.votes?.length || 0) === maxVotes);

        // 3. If there is a tie (at least 2 groups), reset their votes
        if (tiedGroups.length > 1) {
            tiedGroups.forEach(g => {
                g.votes = [];
            });
            await this.saveRoom(room);
            return true;
        }

        return false;
    }

    async areVotesRevealed(roomId: string): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room) return false;

        const totalVotes = room.groups.reduce((acc, g) => acc + (g.votes?.length || 0), 0);
        const expectedTotal = room.participants.length * 3;

        return totalVotes >= expectedTotal;
    }

    private getDefaultColumns(template: Template): Column[] {
        switch (template) {
            case 'STARFISH':
                return [
                    { id: 'keep', title: 'Keep', color: '#4caf50' },
                    { id: 'drop', title: 'Drop', color: '#f44336' },
                    { id: 'start', title: 'Start', color: '#2196f3' },
                    { id: 'stop', title: 'Stop', color: '#ff9800' },
                    { id: 'more', title: 'More of', color: '#9c27b0' },
                    { id: 'less', title: 'Less of', color: '#795548' }
                ];
            case 'CLASSIC':
            default:
                return [
                    { id: 'well', title: 'What went well', color: '#4caf50' },
                    { id: 'not_well', title: "What didn't go well", color: '#f44336' },
                    { id: 'actions', title: 'Action items', color: '#2196f3' }
                ];
        }
    }
}

export const roomStore = new RoomStore();
