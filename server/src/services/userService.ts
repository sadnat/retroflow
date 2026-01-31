import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, TokenPayload } from '../../../shared/types';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export class UserService {
    async register(email: string, password: string, name: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new Error('Email already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                name,
                passwordHash,
            },
        });

        // Generate tokens
        const accessToken = this.generateAccessToken(user.id, user.email);
        const refreshToken = await this.generateRefreshToken(user.id);

        return {
            user: this.toUserDto(user),
            accessToken,
            refreshToken,
        };
    }

    async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new Error('Invalid email or password');
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new Error('Invalid email or password');
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        // Generate tokens
        const accessToken = this.generateAccessToken(user.id, user.email);
        const refreshToken = await this.generateRefreshToken(user.id);

        return {
            user: this.toUserDto(user),
            accessToken,
            refreshToken,
        };
    }

    async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        // Verify refresh token
        let payload: TokenPayload;
        try {
            payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;
        } catch {
            throw new Error('Invalid refresh token');
        }

        // Check if token exists in DB
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            // Delete expired token if exists
            if (storedToken) {
                await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            }
            throw new Error('Refresh token expired');
        }

        // Delete old token
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });

        // Generate new tokens
        const newAccessToken = this.generateAccessToken(storedToken.user.id, storedToken.user.email);
        const newRefreshToken = await this.generateRefreshToken(storedToken.user.id);

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }

    async logout(refreshToken: string): Promise<void> {
        await prisma.refreshToken.deleteMany({
            where: { token: refreshToken },
        });
    }

    async getUserById(userId: string): Promise<User | null> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        return user ? this.toUserDto(user) : null;
    }

    async verifyAccessToken(token: string): Promise<TokenPayload> {
        try {
            return jwt.verify(token, JWT_SECRET) as TokenPayload;
        } catch {
            throw new Error('Invalid access token');
        }
    }

    private generateAccessToken(userId: string, email: string): string {
        return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    }

    private async generateRefreshToken(userId: string): Promise<string> {
        const token = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
        
        // Store in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data: {
                token,
                userId,
                expiresAt,
            },
        });

        return token;
    }

    private toUserDto(user: any): User {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            createdAt: user.createdAt.getTime(),
            lastLoginAt: user.lastLoginAt?.getTime(),
        };
    }
}

export const userService = new UserService();
