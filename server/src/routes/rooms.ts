import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { roomService } from '../services/roomService';
import { roomStore } from '../store/roomStore';

const router = Router();

// GET /api/rooms - Get user's rooms
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const rooms = await roomService.getUserRooms(req.user!.userId);
        res.json({ rooms });
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Failed to get rooms' });
    }
});

// GET /api/rooms/:id - Get room details
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const roomId = req.params.id;
        
        // Check if user has access to this room
        const participant = await roomService.getParticipantByUserId(roomId, req.user!.userId);
        const isOwner = await roomService.isRoomOwner(roomId, req.user!.userId);
        
        if (!participant && !isOwner) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const metadata = await roomService.getRoomMetadata(roomId);
        if (!metadata) {
            return res.status(404).json({ error: 'Room not found' });
        }
        
        res.json({ room: metadata });
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({ error: 'Failed to get room' });
    }
});

// DELETE /api/rooms/:id - Delete a room
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const roomId = req.params.id;
        const userId = req.user!.userId;
        
        // Check if user is the owner
        const isOwner = await roomService.isRoomOwner(roomId, userId);
        if (!isOwner) {
            return res.status(403).json({ error: 'Only the room owner can delete this room' });
        }
        
        // Delete from Redis if exists
        try {
            await roomStore.deleteRoom(roomId);
        } catch (e) {
            // Room might not exist in Redis, continue
        }
        
        // Delete from PostgreSQL
        await roomService.deleteRoom(roomId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

// GET /api/rooms/:id/check-password - Check if room has a password
router.get('/:id/check-password', async (req: Request, res: Response) => {
    try {
        const hasPassword = await roomService.roomHasPassword(req.params.id);
        res.json({ hasPassword });
    } catch (error) {
        console.error('Check password error:', error);
        res.status(500).json({ error: 'Failed to check password' });
    }
});

export default router;
