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
                    background: var(--bg-color);
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
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                .my-retros-header h1 {
                    margin: 0;
                    flex: 1;
                    color: #111827;
                    font-size: 1.8rem;
                }
                .back-button {
                    background: white;
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 0.6rem 1.2rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                    box-shadow: var(--shadow-sm);
                }
                .back-button:hover {
                    background: #f9fafb;
                    border-color: #d1d5db;
                    transform: translateY(-1px);
                    box-shadow: var(--shadow-md);
                }
                .filter-tabs {
                    display: flex;
                    gap: 0.8rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                .filter-tab {
                    background: white;
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    padding: 0.6rem 1.2rem;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .filter-tab:hover {
                    border-color: #d1d5db;
                    color: var(--text-primary);
                }
                .filter-tab.active {
                    background: var(--accent-color);
                    border-color: var(--accent-color);
                    color: white;
                    box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
                }
                .loading, .error, .empty-state {
                    text-align: center;
                    padding: 3rem;
                    color: var(--text-secondary);
                }
                .error {
                    color: #ef4444;
                }
                .empty-state p {
                    margin-bottom: 1.5rem;
                    font-size: 1.1rem;
                }
                .rooms-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .room-card {
                    background: white;
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: var(--shadow-sm);
                }
                .room-card:hover {
                    border-color: var(--accent-color);
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }
                .room-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                    gap: 1rem;
                }
                .room-card-header h3 {
                    margin: 0;
                    font-size: 1.2rem;
                    flex: 1;
                    color: #111827;
                    font-weight: 600;
                }
                .room-card-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                }
                .btn-delete-room {
                    background: white;
                    border: 1px solid #fecaca;
                    color: #ef4444;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1.2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    transition: all 0.2s;
                }
                .btn-delete-room:hover {
                    background: #fef2f2;
                    border-color: #ef4444;
                }
                .confirm-delete {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                }
                .confirm-delete span {
                    color: #ef4444;
                    font-weight: 600;
                }
                .btn-confirm-yes, .btn-confirm-no {
                    padding: 0.3rem 0.8rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 600;
                    border: 1px solid transparent;
                }
                .btn-confirm-yes {
                    background: #ef4444;
                    color: white;
                }
                .btn-confirm-yes:disabled {
                    opacity: 0.5;
                }
                .btn-confirm-no {
                    background: white;
                    border-color: #d1d5db;
                    color: #374151;
                }
                .status-badge {
                    padding: 0.2rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    white-space: nowrap;
                    text-transform: uppercase;
                }
                .status-badge.active {
                    background: #ecfdf5;
                    color: #059669;
                    border: 1px solid #a7f3d0;
                }
                .status-badge.closed {
                    background: #f3f4f6;
                    color: #6b7280;
                    border: 1px solid #e5e7eb;
                }
                .status-badge.archived {
                    background: #fff7ed;
                    color: #ea580c;
                    border: 1px solid #fed7aa;
                }
                .room-card-meta {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                .template-badge, .phase-badge {
                    padding: 0.2rem 0.6rem;
                    background: #f3f4f6;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #4b5563;
                }
                .room-card-stats {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    border-top: 1px solid #f3f4f6;
                    padding-top: 0.8rem;
                }
                .btn-primary {
                    padding: 0.8rem 1.5rem;
                    background: var(--accent-color);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
                    transition: all 0.2s;
                }
                .btn-primary:hover {
                    background: #1d4ed8;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 8px rgba(37, 99, 235, 0.3);
                }
            `}</style>
        </div>
    );
};
