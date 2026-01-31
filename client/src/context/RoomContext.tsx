import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Room, Participant, PostIt, ParticipantRole } from '../../../shared/types';
import { useSocket } from './SocketContext';

// LocalStorage keys
const STORAGE_KEYS = {
    ROOM_ID: 'retroflow_room_id',
    USER_ID: 'retroflow_user_id',
    USER_NAME: 'retroflow_user_name',
};

interface CreateRoomOptions {
    name: string;
    template: string;
    facilitatorName: string;
    password?: string;
    maxPostitsPerUser?: number;
}

interface JoinRoomOptions {
    roomId: string;
    participantName: string;
    password?: string;
    role?: ParticipantRole;
}

interface RoomContextType {
    room: Room | null;
    odlUserId: string | null;
    userName: string | null;
    isRejoining: boolean;
    myRole: ParticipantRole | null;
    isFacilitator: boolean;
    isObserver: boolean;
    setRoom: (room: Room | null) => void;
    setUserId: (id: string | null) => void;
    joinRoom: (options: JoinRoomOptions) => Promise<void>;
    createRoom: (options: CreateRoomOptions) => Promise<void>;
    rejoinRoom: () => Promise<boolean>;
    deleteRoom: () => Promise<void>;
    closeRoom: () => Promise<void>;
    reopenRoom: () => Promise<void>;
    changeParticipantRole: (participantId: string, role: ParticipantRole) => Promise<void>;
    checkRoom: (roomId: string) => Promise<{ roomName: string; requiresPassword: boolean; status: string }>;
    leaveRoom: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = () => {
    const context = useContext(RoomContext);
    if (!context) throw new Error('useRoom must be used within RoomProvider');
    return context;
};

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { socket, isConnected, onReconnect } = useSocket();
    const [room, setRoomState] = useState<Room | null>(null);
    const [odlUserId, setUserIdState] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [isRejoining, setIsRejoining] = useState(false);
    const hasAttemptedRejoin = useRef(false);

    // Compute role info
    const myParticipant = room?.participants.find(p => p.id === odlUserId);
    const myRole = myParticipant?.role || null;
    const isFacilitator = myRole === 'FACILITATOR';
    const isObserver = myRole === 'OBSERVER';

    // Wrapper to update both state and localStorage
    const setRoom = useCallback((newRoom: Room | null) => {
        setRoomState(newRoom);
        if (newRoom) {
            localStorage.setItem(STORAGE_KEYS.ROOM_ID, newRoom.id);
        }
    }, []);

    const setUserId = useCallback((id: string | null) => {
        setUserIdState(id);
        if (id) {
            localStorage.setItem(STORAGE_KEYS.USER_ID, id);
        }
    }, []);

    const saveUserName = useCallback((name: string) => {
        setUserName(name);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, name);
    }, []);

    // Clear all session data
    const clearSession = useCallback(() => {
        localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_NAME);
        setRoomState(null);
        setUserIdState(null);
        setUserName(null);
    }, []);

    // Leave room (clear local data without deleting the room)
    const leaveRoom = useCallback(() => {
        clearSession();
    }, [clearSession]);

    // Check room info before joining
    const checkRoom = useCallback((roomId: string): Promise<{ roomName: string; requiresPassword: boolean; status: string }> => {
        return new Promise((resolve, reject) => {
            if (!socket) return reject('Socket not connected');

            socket.emit('room:check', { roomId }, (response: any) => {
                if (response.success) {
                    resolve({
                        roomName: response.roomName,
                        requiresPassword: response.requiresPassword,
                        status: response.status,
                    });
                } else {
                    reject(response.error);
                }
            });
        });
    }, [socket]);

    // Rejoin room using stored credentials
    const rejoinRoom = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!socket || !isConnected) {
                resolve(false);
                return;
            }

            const storedRoomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
            const storedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
            const storedUserName = localStorage.getItem(STORAGE_KEYS.USER_NAME);

            if (!storedRoomId || !storedUserId) {
                resolve(false);
                return;
            }

            setIsRejoining(true);
            console.log('Attempting to rejoin room:', storedRoomId, 'as user:', storedUserId);

            socket.emit('room:rejoin', { roomId: storedRoomId, participantId: storedUserId }, (response: any) => {
                setIsRejoining(false);
                if (response.success) {
                    setRoomState(response.room);
                    setUserIdState(response.odlUserId);
                    if (storedUserName) setUserName(storedUserName);
                    console.log('Successfully rejoined room');
                    resolve(true);
                } else {
                    console.log('Failed to rejoin room:', response.error);
                    clearSession();
                    resolve(false);
                }
            });
        });
    }, [socket, isConnected, clearSession]);

    // Create room
    const createRoom = useCallback((options: CreateRoomOptions): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket) return reject('Socket not connected');

            socket.emit('room:create', options, (response: any) => {
                if (response.success) {
                    setRoom(response.room);
                    setUserId(response.odlUserId);
                    saveUserName(options.facilitatorName);
                    resolve();
                } else {
                    reject(response.error);
                }
            });
        });
    }, [socket, setRoom, setUserId, saveUserName]);

    // Join room
    const joinRoom = useCallback((options: JoinRoomOptions): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket) return reject('Socket not connected');

            socket.emit('room:join', options, (response: any) => {
                if (response.success) {
                    setRoom(response.room);
                    setUserId(response.odlUserId);
                    saveUserName(options.participantName);
                    resolve();
                } else {
                    if (response.requiresPassword) {
                        reject({ message: response.error, requiresPassword: true });
                    } else {
                        reject(response.error);
                    }
                }
            });
        });
    }, [socket, setRoom, setUserId, saveUserName]);

    // Delete room (facilitator only)
    const deleteRoom = useCallback((): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket || !room || !odlUserId) return reject('Not in a room');

            socket.emit('room:delete', { roomId: room.id, odlUserId }, (response: any) => {
                if (response.success) {
                    clearSession();
                    resolve();
                } else {
                    reject(response.error);
                }
            });
        });
    }, [socket, room, odlUserId, clearSession]);

    // Close room (facilitator only)
    const closeRoom = useCallback((): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket || !room || !odlUserId) return reject('Not in a room');

            socket.emit('room:close', { roomId: room.id, odlUserId }, (response: any) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(response.error);
                }
            });
        });
    }, [socket, room, odlUserId]);

    // Reopen room (facilitator only)
    const reopenRoom = useCallback((): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket || !room || !odlUserId) return reject('Not in a room');

            socket.emit('room:reopen', { roomId: room.id, odlUserId }, (response: any) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(response.error);
                }
            });
        });
    }, [socket, room, odlUserId]);

    // Change participant role (facilitator only)
    const changeParticipantRole = useCallback((participantId: string, role: ParticipantRole): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!socket || !room || !odlUserId) return reject('Not in a room');

            socket.emit('participant:role', { roomId: room.id, participantId, role, odlUserId }, (response: any) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(response.error);
                }
            });
        });
    }, [socket, room, odlUserId]);

    // Setup socket event listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('participant:joined', (participant: Participant) => {
            setRoomState((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    participants: [...prev.participants, participant]
                };
            });
        });

        socket.on('participant:status', ({ participantId, isOnline }: { participantId: string, isOnline: boolean }) => {
            setRoomState((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    participants: prev.participants.map(p => 
                        p.id === participantId ? { ...p, isOnline } : p
                    )
                };
            });
        });

        socket.on('room:updated', (updatedRoom: Room) => {
            setRoomState(updatedRoom);
        });

        socket.on('room:deleted', () => {
            clearSession();
        });

        socket.on('postit:created', (postit: PostIt) => {
            setRoomState((prev) => {
                if (!prev) return null;
                if (prev.postits.some(p => p.id === postit.id)) return prev;
                return {
                    ...prev,
                    postits: [...prev.postits, postit]
                };
            });
        });

        return () => {
            socket.off('participant:joined');
            socket.off('participant:status');
            socket.off('room:updated');
            socket.off('room:deleted');
            socket.off('postit:created');
        };
    }, [socket, clearSession]);

    // Clear stored room data on initial load (don't auto-rejoin)
    // User should explicitly choose to rejoin from My Retros
    useEffect(() => {
        // Only clear if there's no ?room= in the URL
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.get('room')) {
            localStorage.removeItem(STORAGE_KEYS.ROOM_ID);
            localStorage.removeItem(STORAGE_KEYS.USER_ID);
        }
    }, []);

    // Setup reconnection callback
    useEffect(() => {
        onReconnect(() => {
            if (room && odlUserId) {
                console.log('Connection restored, rejoining room...');
                rejoinRoom();
            }
        });
    }, [onReconnect, room, odlUserId, rejoinRoom]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <RoomContext.Provider value={{ 
                room, 
                odlUserId, 
                userName,
                isRejoining,
                myRole,
                isFacilitator,
                isObserver,
                setRoom, 
                setUserId, 
                joinRoom, 
                createRoom,
                rejoinRoom,
                deleteRoom,
                closeRoom,
                reopenRoom,
                changeParticipantRole,
                checkRoom,
                leaveRoom
            }}>
                {children}
            </RoomContext.Provider>
        </div>
    );
};
