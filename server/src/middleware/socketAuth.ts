import { Socket } from 'socket.io';
import { userService } from '../services/userService';
import { TokenPayload } from '../../../shared/types';

// Extend Socket type
declare module 'socket.io' {
    interface Socket {
        user?: TokenPayload;
        isGuest?: boolean;
    }
}

// Socket.IO authentication middleware
export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            try {
                const payload = await userService.verifyAccessToken(token);
                socket.user = payload;
                socket.isGuest = false;
                console.log(`Authenticated user connected: ${payload.email}`);
            } catch {
                // Invalid token - treat as guest
                socket.isGuest = true;
                console.log('Guest connected (invalid token)');
            }
        } else {
            // No token - guest connection
            socket.isGuest = true;
            console.log('Guest connected (no token)');
        }
        
        next();
    } catch (error) {
        console.error('Socket auth error:', error);
        next(new Error('Authentication error'));
    }
};
