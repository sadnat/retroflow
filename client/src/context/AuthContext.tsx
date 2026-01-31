import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../../../shared/types';

// Use relative URLs - Vite proxy handles routing to the server
const API_URL = '';

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    justLoggedIn: boolean;
    clearJustLoggedIn: () => void;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'retroflow_access_token',
    REFRESH_TOKEN: 'retroflow_refresh_token',
    USER: 'retroflow_user',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [justLoggedIn, setJustLoggedIn] = useState(false);

    const clearJustLoggedIn = useCallback(() => {
        setJustLoggedIn(false);
    }, []);

    // Load stored auth on mount
    useEffect(() => {
        const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

        if (storedToken && storedUser) {
            setAccessToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    // Save auth to storage
    const saveAuth = useCallback((userData: User, tokens: { accessToken: string; refreshToken: string }) => {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        setAccessToken(tokens.accessToken);
        setUser(userData);
    }, []);

    // Clear auth from storage
    const clearAuth = useCallback(() => {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        setAccessToken(null);
        setUser(null);
    }, []);

    // Login
    const login = useCallback(async (email: string, password: string) => {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        saveAuth(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
        setJustLoggedIn(true);
    }, [saveAuth]);

    // Register
    const register = useCallback(async (email: string, password: string, name: string) => {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        saveAuth(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
        setJustLoggedIn(true);
    }, [saveAuth]);

    // Logout
    const logout = useCallback(async () => {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        try {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });
        } catch {
            // Ignore logout errors
        }

        clearAuth();
    }, [clearAuth]);

    // Refresh tokens
    const refreshAuth = useCallback(async (): Promise<boolean> => {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (!refreshToken) {
            clearAuth();
            return false;
        }

        try {
            const response = await fetch(`${API_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
                clearAuth();
                return false;
            }

            const data = await response.json();
            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
            setAccessToken(data.accessToken);
            return true;
        } catch {
            clearAuth();
            return false;
        }
    }, [clearAuth]);

    // Auto refresh token before expiry
    useEffect(() => {
        if (!accessToken) return;

        // Refresh every 14 minutes (token expires in 15)
        const interval = setInterval(() => {
            refreshAuth();
        }, 14 * 60 * 1000);

        return () => clearInterval(interval);
    }, [accessToken, refreshAuth]);

    return (
        <AuthContext.Provider value={{
            user,
            accessToken,
            isAuthenticated: !!user,
            isLoading,
            justLoggedIn,
            clearJustLoggedIn,
            login,
            register,
            logout,
            refreshAuth,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
