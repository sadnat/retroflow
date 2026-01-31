import { PrismaClient, RoomStatus, ParticipantRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RoomSummary, Template } from '../../../shared/types';

const prisma = new PrismaClient();

export class RoomService {
    // Create a room in the database (metadata only, actual room data stays in Redis)
    async createRoom(
        ownerId: string,
        name: string,
        template: Template,
        password?: string,
        maxPostitsPerUser?: number
    ): Promise<{ roomId: string; participantId: string }> {
        const passwordHash = password ? await bcrypt.hash(password, 10) : null;

        const room = await prisma.room.create({
            data: {
                name,
                template,
                passwordHash,
                maxPostitsPerUser,
                ownerId,
                participants: {
                    create: {
                        userId: ownerId,
                        role: ParticipantRole.FACILITATOR,
                        isOnline: true,
                    },
                },
            },
            include: {
                participants: true,
            },
        });

        return {
            roomId: room.id,
            participantId: room.participants[0].id,
        };
    }

    // Add a participant to a room
    async addParticipant(
        roomId: string,
        userId: string | null,
        guestName: string | null,
        role: ParticipantRole = ParticipantRole.PARTICIPANT
    ): Promise<string> {
        // Check if user is already a participant
        if (userId) {
            const existing = await prisma.roomParticipant.findUnique({
                where: { userId_roomId: { userId, roomId } },
            });
            if (existing) {
                // Update online status and return existing participant
                await prisma.roomParticipant.update({
                    where: { id: existing.id },
                    data: { isOnline: true },
                });
                return existing.id;
            }
        }

        const participant = await prisma.roomParticipant.create({
            data: {
                roomId,
                userId,
                guestName: userId ? null : guestName,
                role,
                isOnline: true,
            },
        });

        return participant.id;
    }

    // Verify room password
    async verifyRoomPassword(roomId: string, password: string): Promise<boolean> {
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: { passwordHash: true },
        });

        if (!room || !room.passwordHash) {
            return true; // No password required
        }

        return bcrypt.compare(password, room.passwordHash);
    }

    // Check if room has a password
    async roomHasPassword(roomId: string): Promise<boolean> {
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: { passwordHash: true },
        });
        return !!room?.passwordHash;
    }

    // Get room metadata
    async getRoomMetadata(roomId: string) {
        return prisma.room.findUnique({
            where: { id: roomId },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                participants: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true } },
                    },
                },
            },
        });
    }

    // Get participant info
    async getParticipant(roomId: string, participantId: string) {
        return prisma.roomParticipant.findFirst({
            where: { id: participantId, roomId },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
            },
        });
    }

    // Get participant by user ID
    async getParticipantByUserId(roomId: string, userId: string) {
        return prisma.roomParticipant.findUnique({
            where: { userId_roomId: { userId, roomId } },
        });
    }

    // Update participant online status
    async setParticipantOnline(participantId: string, isOnline: boolean) {
        return prisma.roomParticipant.update({
            where: { id: participantId },
            data: { isOnline },
        });
    }

    // Update participant role
    async setParticipantRole(participantId: string, role: ParticipantRole) {
        return prisma.roomParticipant.update({
            where: { id: participantId },
            data: { role },
        });
    }

    // Get user's rooms
    async getUserRooms(userId: string): Promise<RoomSummary[]> {
        const rooms = await prisma.room.findMany({
            where: {
                OR: [
                    { ownerId: userId },
                    { participants: { some: { userId } } },
                ],
            },
            include: {
                participants: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return rooms.map(room => ({
            id: room.id,
            name: room.name,
            template: room.template as Template,
            status: room.status as any,
            phase: room.phase as any,
            participantCount: room.participants.length,
            postitCount: 0, // Will be fetched from Redis
            createdAt: room.createdAt.getTime(),
            closedAt: room.closedAt?.getTime(),
        }));
    }

    // Update room status
    async updateRoomStatus(roomId: string, status: RoomStatus) {
        return prisma.room.update({
            where: { id: roomId },
            data: {
                status,
                closedAt: status === RoomStatus.CLOSED ? new Date() : null,
            },
        });
    }

    // Update room phase
    async updateRoomPhase(roomId: string, phase: string) {
        return prisma.room.update({
            where: { id: roomId },
            data: { phase },
        });
    }

    // Delete room
    async deleteRoom(roomId: string) {
        return prisma.room.delete({
            where: { id: roomId },
        });
    }

    // Check if user is room owner
    async isRoomOwner(roomId: string, userId: string): Promise<boolean> {
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: { ownerId: true },
        });
        return room?.ownerId === userId;
    }

    // Get participant role
    async getParticipantRole(roomId: string, participantId: string): Promise<ParticipantRole | null> {
        const participant = await prisma.roomParticipant.findFirst({
            where: { id: participantId, roomId },
            select: { role: true },
        });
        return participant?.role || null;
    }
}

export const roomService = new RoomService();
