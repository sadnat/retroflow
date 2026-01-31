import React, { useState, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

export const JoinPage: React.FC<{ roomId: string }> = ({ roomId }) => {
    const { joinRoom, checkRoom } = useRoom();
    const { isConnected } = useSocket();
    const { user, isAuthenticated } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingRoom, setCheckingRoom] = useState(true);
    const [error, setError] = useState('');
    const [roomInfo, setRoomInfo] = useState<{ roomName: string; requiresPassword: boolean; status: string } | null>(null);
    const [hasChecked, setHasChecked] = useState(false);

    // Check room info when socket is connected
    useEffect(() => {
        if (!isConnected || hasChecked) return;

        const checkRoomInfo = async () => {
            try {
                const info = await checkRoom(roomId);
                setRoomInfo(info);
            } catch (err: any) {
                setError(err || t.errors.roomNotFound);
            } finally {
                setCheckingRoom(false);
                setHasChecked(true);
            }
        };

        checkRoomInfo();
    }, [roomId, checkRoom, isConnected, hasChecked]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError('');
        try {
            await joinRoom({
                roomId,
                participantName: name,
                password: password || undefined,
            });
        } catch (err: any) {
            if (err.requiresPassword) {
                setError(t.errors.invalidPassword);
            } else {
                setError(err.message || err || 'Unable to join room');
            }
        } finally {
            setLoading(false);
        }
    };

    if (checkingRoom || !isConnected) {
        return (
            <div className="join-container glass">
                <div className="loading">
                    <div className="spinner"></div>
                    <p>{!isConnected ? 'Connecting...' : 'Checking room...'}</p>
                </div>
                <style>{`
                    .join-container {
                        padding: 3rem;
                        border-radius: 20px;
                        width: 100%;
                        max-width: 400px;
                        text-align: center;
                    }
                    .loading {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 1rem;
                    }
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 3px solid rgba(255,255,255,0.1);
                        border-top-color: var(--accent-color);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="join-container glass">
            <h1>{t.dashboard.joinRoom}</h1>
            {roomInfo && (
                <p className="room-name">{roomInfo.roomName}</p>
            )}
            
            {roomInfo?.status !== 'ACTIVE' && (
                <div className="closed-notice">
                    This retrospective is closed. You can still view it in read-only mode.
                </div>
            )}
            
            <p className="subtitle">Enter your name to {roomInfo?.status === 'ACTIVE' ? 'participate' : 'view'}</p>

            {isAuthenticated && (
                <div className="auth-info">
                    Logged in as {user?.name}
                </div>
            )}

            <form onSubmit={handleJoin} className="create-form">
                <div className="form-group">
                    <label>{t.dashboard.yourName}</label>
                    <input
                        type="text"
                        placeholder="Bob"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                    />
                </div>

                {roomInfo?.requiresPassword && (
                    <div className="form-group">
                        <label>{t.auth.password}</label>
                        <input
                            type="password"
                            placeholder="Room password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <span className="password-hint">This room is password protected</span>
                    </div>
                )}

                {error && <p className="error-message">{error}</p>}

                <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={loading}
                >
                    {loading ? t.app.loading : (roomInfo?.status === 'ACTIVE' ? t.dashboard.join : 'View Retrospective')}
                </button>
            </form>

            <div className="back-link">
                <a href="/">{t.app.back} to home</a>
            </div>

            <style>{`
        .join-container {
          padding: 3rem;
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          text-align: left;
        }
        .room-name {
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--accent-color);
          margin: 0 0 0.5rem;
        }
        .closed-notice {
          padding: 0.75rem 1rem;
          background: rgba(255, 152, 0, 0.1);
          border: 1px solid rgba(255, 152, 0, 0.3);
          border-radius: 8px;
          font-size: 0.9rem;
          color: #ff9800;
          margin-bottom: 1rem;
        }
        .subtitle { 
          color: var(--text-secondary); 
          margin-bottom: 1.5rem; 
        }
        .auth-info {
          padding: 0.75rem 1rem;
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.3);
          border-radius: 8px;
          font-size: 0.9rem;
          color: #4caf50;
          margin-bottom: 1.5rem;
        }
        .create-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        label {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        input {
          padding: 0.8rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: white;
          font-size: 1rem;
        }
        .password-hint {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .btn-primary {
          background: var(--accent-color);
          color: white;
          border: none;
          padding: 1rem;
          border-radius: 8px;
          font-weight: bold;
          font-size: 1rem;
          cursor: pointer;
          margin-top: 0.5rem;
        }
        .btn-primary:disabled { 
          opacity: 0.5; 
          cursor: not-allowed;
        }
        .error-message { 
          color: var(--retro-red); 
          font-size: 0.9rem; 
        }
        .back-link {
          margin-top: 1.5rem;
          text-align: center;
        }
        .back-link a {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        .back-link a:hover {
          color: var(--accent-color);
        }
      `}</style>
        </div>
    );
};
