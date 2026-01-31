import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoomSummary } from '../../../shared/types';
import { t } from '../i18n';

const API_URL = '';

interface MyRetrosPageProps {
    onBack: () => void;
    onJoinRoom: (roomId: string) => void;
}

export const MyRetrosPage: React.FC<MyRetrosPageProps> = ({ onBack, onJoinRoom }) => {
    const { accessToken } = useAuth();
    const [rooms, setRooms] = useState<RoomSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchRooms = async () => {
        try {
            const response = await fetch(`${API_URL}/api/rooms`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch rooms');
            }

            const data = await response.json();
            setRooms(data.rooms);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, [accessToken]);

    const handleDelete = async (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        
        if (confirmDeleteId !== roomId) {
            setConfirmDeleteId(roomId);
            return;
        }
        
        setDeletingId(roomId);
        try {
            const response = await fetch(`${API_URL}/api/rooms/${roomId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete room');
            }

            // Remove from local state
            setRooms(rooms.filter(r => r.id !== roomId));
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmDeleteId(null);
    };

    const filteredRooms = rooms.filter(room => {
        if (filter === 'all') return true;
        if (filter === 'active') return room.status === 'ACTIVE';
        if (filter === 'closed') return room.status === 'CLOSED' || room.status === 'ARCHIVED';
        return true;
    });

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="status-badge active">{t.myRetros.status.active}</span>;
            case 'CLOSED':
                return <span className="status-badge closed">{t.myRetros.status.closed}</span>;
            case 'ARCHIVED':
                return <span className="status-badge archived">{t.myRetros.status.archived}</span>;
            default:
                return null;
        }
    };

    return (
        <div className="my-retros-page">
            <div className="my-retros-container">
                <div className="my-retros-header">
                    <button onClick={onBack} className="back-button">
                        {t.app.back}
                    </button>
                    <h1>{t.myRetros.title}</h1>
                </div>

                <div className="filter-tabs">
                    <button 
                        className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        {t.myRetros.all} ({rooms.length})
                    </button>
                    <button 
                        className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
                        onClick={() => setFilter('active')}
                    >
                        {t.myRetros.active} ({rooms.filter(r => r.status === 'ACTIVE').length})
                    </button>
                    <button 
                        className={`filter-tab ${filter === 'closed' ? 'active' : ''}`}
                        onClick={() => setFilter('closed')}
                    >
                        {t.myRetros.closed} ({rooms.filter(r => r.status !== 'ACTIVE').length})
                    </button>
                </div>

                {isLoading ? (
                    <div className="loading">{t.app.loading}</div>
                ) : error ? (
                    <div className="error">{error}</div>
                ) : filteredRooms.length === 0 ? (
                    <div className="empty-state">
                        <p>{t.myRetros.noRetros}</p>
                        <button onClick={onBack} className="btn-primary">
                            {t.myRetros.createFirst}
                        </button>
                    </div>
                ) : (
                    <div className="rooms-list">
                        {filteredRooms.map(room => (
                            <div key={room.id} className="room-card" onClick={() => onJoinRoom(room.id)}>
                                <div className="room-card-header">
                                    <h3>{room.name}</h3>
                                    <div className="room-card-actions">
                                        {getStatusBadge(room.status)}
                                        {confirmDeleteId === room.id ? (
                                            <div className="confirm-delete">
                                                <span>Delete?</span>
                                                <button 
                                                    className="btn-confirm-yes"
                                                    onClick={(e) => handleDelete(e, room.id)}
                                                    disabled={deletingId === room.id}
                                                >
                                                    {deletingId === room.id ? '...' : 'Yes'}
                                                </button>
                                                <button 
                                                    className="btn-confirm-no"
                                                    onClick={handleCancelDelete}
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                className="btn-delete-room"
                                                onClick={(e) => handleDelete(e, room.id)}
                                                title={t.app.delete}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="room-card-meta">
                                    <span className="template-badge">{room.template}</span>
                                    <span className="phase-badge">{t.phases[room.phase as keyof typeof t.phases] || room.phase}</span>
                                </div>
                                <div className="room-card-stats">
                                    <span>{room.participantCount} {t.room.participants.toLowerCase()}</span>
                                    <span>{formatDate(room.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .my-retros-page {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    padding: 2rem;
                    background: var(--bg-primary);
                    overflow-y: auto;
                    overflow-x: hidden;
                    box-sizing: border-box;
                }
                .my-retros-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding-bottom: 4rem;
                }
                .my-retros-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .my-retros-header h1 {
                    margin: 0;
                    flex: 1;
                }
                .back-button {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid var(--border-color);
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    cursor: pointer;
                }
                .back-button:hover {
                    background: rgba(255,255,255,0.2);
                }
                .filter-tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                .filter-tab {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.9rem;
                }
                .filter-tab.active {
                    background: var(--accent-color);
                    border-color: var(--accent-color);
                    color: white;
                }
                .loading, .error, .empty-state {
                    text-align: center;
                    padding: 3rem;
                    color: var(--text-secondary);
                }
                .error {
                    color: #f44336;
                }
                .empty-state p {
                    margin-bottom: 1rem;
                }
                .rooms-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .room-card {
                    background: var(--panel-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.25rem;
                    cursor: pointer;
                    transition: border-color 0.2s, transform 0.2s;
                }
                .room-card:hover {
                    border-color: var(--accent-color);
                    transform: translateY(-2px);
                }
                .room-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.75rem;
                    gap: 1rem;
                }
                .room-card-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    flex: 1;
                }
                .room-card-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .btn-delete-room {
                    background: rgba(244, 67, 54, 0.1);
                    border: 1px solid rgba(244, 67, 54, 0.3);
                    color: #f44336;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 1.2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    transition: all 0.2s;
                }
                .btn-delete-room:hover {
                    background: rgba(244, 67, 54, 0.3);
                }
                .confirm-delete {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                }
                .confirm-delete span {
                    color: #f44336;
                }
                .btn-confirm-yes, .btn-confirm-no {
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    border: none;
                }
                .btn-confirm-yes {
                    background: #f44336;
                    color: white;
                }
                .btn-confirm-yes:disabled {
                    opacity: 0.5;
                }
                .btn-confirm-no {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }
                .status-badge {
                    padding: 0.2rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    white-space: nowrap;
                }
                .status-badge.active {
                    background: rgba(76, 175, 80, 0.2);
                    color: #4caf50;
                }
                .status-badge.closed {
                    background: rgba(158, 158, 158, 0.2);
                    color: #9e9e9e;
                }
                .status-badge.archived {
                    background: rgba(255, 152, 0, 0.2);
                    color: #ff9800;
                }
                .room-card-meta {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                }
                .template-badge, .phase-badge {
                    padding: 0.2rem 0.5rem;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                }
                .room-card-stats {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }
                .btn-primary {
                    padding: 0.75rem 1.5rem;
                    background: var(--accent-color);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 1rem;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
};
