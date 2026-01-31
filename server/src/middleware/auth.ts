import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { TokenPayload } from '../../../shared/types';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

// Middleware for routes that require authentication
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const payload = await userService.verifyAccessToken(token);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Middleware for routes that optionally accept authentication
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const payload = await userService.verifyAccessToken(token);
            req.user = payload;
        }
        next();
    } catch {
        // Invalid token, but continue without auth
        next();
    }
};
