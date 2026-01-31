import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    onReconnect: (callback: () => void) => void;
    reconnectWithToken: (token: string | null) => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    onReconnect: () => {},
    reconnectWithToken: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
    children: React.ReactNode;
    authToken?: string | null;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children, authToken }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectCallbackRef = useRef<(() => void) | null>(null);
    const currentTokenRef = useRef<string | null>(authToken || null);

    const onReconnect = useCallback((callback: () => void) => {
        reconnectCallbackRef.current = callback;
    }, []);

    const createSocket = useCallback((token: string | null) => {
        // Use relative URL - Vite proxy handles routing to the server
        const socketInstance = io({
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            auth: token ? { token } : undefined,
        });

        socketInstance.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to socket server', token ? '(authenticated)' : '(guest)');
            
            if (reconnectCallbackRef.current) {
                reconnectCallbackRef.current();
            }
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from socket server');
        });

        socketInstance.on('reconnect', () => {
            console.log('Reconnected to socket server');
            if (reconnectCallbackRef.current) {
                reconnectCallbackRef.current();
            }
        });

        socketInstance.on('error', (error: { message: string }) => {
            console.error('Socket error:', error.message);
        });

        return socketInstance;
    }, []);

    // Reconnect with new token (after login/logout)
    const reconnectWithToken = useCallback((token: string | null) => {
        if (currentTokenRef.current === token) return;
        currentTokenRef.current = token;

        if (socket) {
            socket.disconnect();
        }

        const newSocket = createSocket(token);
        setSocket(newSocket);
    }, [socket, createSocket]);

    // Initial connection
    useEffect(() => {
        const socketInstance = createSocket(authToken || null);
        currentTokenRef.current = authToken || null;
        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []); // Only run once on mount

    // Update token when authToken changes
    useEffect(() => {
        if (authToken !== currentTokenRef.current) {
            reconnectWithToken(authToken || null);
        }
    }, [authToken, reconnectWithToken]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, onReconnect, reconnectWithToken }}>
            {children}
        </SocketContext.Provider>
    );
};
