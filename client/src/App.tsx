import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { useRoom } from './context/RoomContext'
import { SocketProvider } from './context/SocketContext'
import { RoomProvider } from './context/RoomContext'
import { Dashboard } from './pages/Dashboard'
import { JoinPage } from './pages/Join'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { MyRetrosPage } from './pages/MyRetros'
import { Board } from './components/Board/Board'
import { PhaseControl } from './components/PhaseControl'
import { Timer } from './components/Timer'
import { t } from './i18n'
import './App.css'

// Inner app with room context
function AppContent() {
  const { user, logout, isAuthenticated, accessToken, justLoggedIn, clearJustLoggedIn } = useAuth();
  const { room, odlUserId, isRejoining, deleteRoom, closeRoom, reopenRoom, leaveRoom, isFacilitator, isObserver, changeParticipantRole } = useRoom();
  const [showParticipants, setShowParticipants] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMyRetros, setShowMyRetros] = useState(justLoggedIn);
  const [linkCopied, setLinkCopied] = useState(false);

  // Clear justLoggedIn flag after showing MyRetros
  useEffect(() => {
    if (justLoggedIn) {
      clearJustLoggedIn();
    }
  }, [justLoggedIn, clearJustLoggedIn]);

  // Simple URL handling for roomId
  const queryParams = new URLSearchParams(window.location.search);
  const urlRoomId = queryParams.get('room');

  const onlineCount = room?.participants.filter(p => p.isOnline !== false).length || 0;

  const handleDeleteRoom = async () => {
    try {
      await deleteRoom();
      setShowDeleteConfirm(false);
    } catch (error) {
      alert('Error: ' + error);
    }
  };

  const handleCloseRoom = async () => {
    try {
      await closeRoom();
    } catch (error) {
      alert('Error: ' + error);
    }
  };

  const handleReopenRoom = async () => {
    try {
      await reopenRoom();
    } catch (error) {
      alert('Error: ' + error);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}?room=${room?.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'FACILITATOR':
        return <span className="role-badge facilitator">{t.room.facilitator}</span>;
      case 'OBSERVER':
        return <span className="role-badge observer">{t.room.observer}</span>;
      default:
        return null;
    }
  };

  // Show loading state while rejoining
  if (isRejoining) {
    return (
      <div className="app-container">
        <div className="rejoining-overlay">
          <div className="rejoining-content">
            <div className="spinner"></div>
            <p>Reconnecting...</p>
          </div>
        </div>
        <style>{`
          .rejoining-overlay {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-primary);
          }
          .rejoining-content {
            text-align: center;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // My retros page
  if (showMyRetros && isAuthenticated) {
    return (
      <MyRetrosPage 
        onBack={() => setShowMyRetros(false)}
        onJoinRoom={(roomId) => {
          setShowMyRetros(false);
          window.location.href = `?room=${roomId}`;
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {room ? (
        <div className={`room-view phase-${room.phase.toLowerCase()}`}>
          <header className="room-header">
            <div className="room-info">
              <h2>{room.name}</h2>
              <span className="phase-badge">{t.phases[room.phase as keyof typeof t.phases]}</span>
              {room.status !== 'ACTIVE' && (
                <span className="status-badge closed">{room.status}</span>
              )}
              {isObserver && (
                <span className="observer-notice">Read-only mode</span>
              )}
            </div>
            <div className="room-controls">
              <Timer />
              {!isObserver && <PhaseControl />}
              <button
                className="btn-share"
                onClick={handleCopyLink}
              >
                {linkCopied ? t.room.linkCopied : t.room.copyLink}
              </button>
              
              {/* Participants dropdown */}
              <div className="participants-dropdown">
                <button 
                  className="btn-participants"
                  onClick={() => setShowParticipants(!showParticipants)}
                >
                  <span className="online-indicator"></span>
                  {onlineCount}/{room.participants.length}
                </button>
                
                {showParticipants && (
                  <div className="participants-list">
                    <div className="participants-header">{t.room.participants}</div>
                    {room.participants.map((p) => (
                      <div key={p.id} className="participant-item">
                        <span className={`status-dot ${p.isOnline !== false ? 'online' : 'offline'}`}></span>
                        <span className="participant-name">
                          {p.name}
                          {getRoleBadge(p.role)}
                          {p.id === odlUserId && <span className="you-badge">You</span>}
                        </span>
                        {isFacilitator && p.id !== odlUserId && (
                          <select 
                            className="role-select"
                            value={p.role}
                            onChange={(e) => changeParticipantRole(p.id, e.target.value as any)}
                          >
                            <option value="PARTICIPANT">{t.room.participant}</option>
                            <option value="OBSERVER">{t.room.observer}</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Facilitator actions */}
              {isFacilitator && (
                <>
                  {room.status === 'ACTIVE' ? (
                    <button 
                      className="btn-close"
                      onClick={handleCloseRoom}
                      title={t.room.closeRoom}
                    >
                      {t.app.close}
                    </button>
                  ) : (
                    <button 
                      className="btn-reopen"
                      onClick={handleReopenRoom}
                      title={t.room.reopenRoom}
                    >
                      {t.room.reopenRoom}
                    </button>
                  )}
                  <button 
                    className="btn-delete"
                    onClick={() => setShowDeleteConfirm(true)}
                    title={t.room.deleteRoom}
                  >
                    {t.app.delete}
                  </button>
                </>
              )}

              {/* Leave button for non-facilitators */}
              {!isFacilitator && (
                <button 
                  className="btn-leave"
                  onClick={leaveRoom}
                  title={t.room.leaveRoom}
                >
                  {t.room.leaveRoom}
                </button>
              )}

              {/* User menu */}
              {isAuthenticated && (
                <div className="user-menu">
                  <span className="user-name">{user?.name}</span>
                  <button className="btn-logout" onClick={logout}>{t.auth.logout}</button>
                </div>
              )}
            </div>
          </header>

          <main className="room-content">
            <Board />
          </main>

          {/* Delete confirmation modal */}
          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>{t.room.deleteRoom}?</h3>
                <p>{t.room.confirmDelete}</p>
                <div className="modal-actions">
                  <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>
                    {t.app.cancel}
                  </button>
                  <button className="btn-confirm-delete" onClick={handleDeleteRoom}>
                    {t.app.delete}
                  </button>
                </div>
              </div>
            </div>
          )}

          <style>{`
            .room-view {
              width: 100%;
              height: 100vh;
              display: flex;
              flex-direction: column;
              background: var(--bg-color);
            }
            .room-view.phase-conclusion .room-content {
              overflow-y: auto;
            }
            .room-header {
              height: 64px;
              padding: 0 2rem;
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: white;
              border-bottom: 1px solid var(--border-color);
              box-shadow: var(--shadow-sm);
              z-index: 10;
            }
            .room-info {
              display: flex;
              align-items: center;
              gap: 1rem;
            }
            .room-info h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #111827; }
            .phase-badge, .status-badge {
              padding: 0.25rem 0.75rem;
              background: #eff6ff;
              color: var(--accent-color);
              border: 1px solid #bfdbfe;
              border-radius: 20px;
              font-size: 0.75rem;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .status-badge.closed {
              background: #f3f4f6;
              color: #6b7280;
              border-color: #d1d5db;
            }
            .observer-notice {
              padding: 0.2rem 0.6rem;
              background: #fff7ed;
              border: 1px solid #fed7aa;
              border-radius: 4px;
              font-size: 0.75rem;
              color: #c2410c;
              font-weight: 600;
            }
            .room-content {
              flex: 1;
              padding: 0;
              overflow-x: auto;
              overflow-y: hidden;
              position: relative;
            }
            .room-controls {
              display: flex;
              align-items: center;
              gap: 0.8rem;
            }
            .btn-share, .btn-participants, .btn-delete, .btn-leave, .btn-close, .btn-reopen, .btn-logout {
              background: white;
              border: 1px solid var(--border-color);
              color: var(--text-primary);
              padding: 0.5rem 1rem;
              border-radius: 8px;
              cursor: pointer;
              font-size: 0.9rem;
              font-weight: 500;
              display: flex;
              align-items: center;
              gap: 0.5rem;
              transition: all 0.2s;
              box-shadow: var(--shadow-sm);
            }
            .btn-share {
                background: var(--accent-color);
                color: white;
                border: none;
                font-weight: 600;
            }
            .btn-share:hover {
                background: #1d4ed8;
                transform: translateY(-1px);
                box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
            }
            .btn-participants:hover {
                background: #f9fafb;
                border-color: #d1d5db;
            }
            
            .btn-logout {
                color: #ef4444;
                border-color: #fecaca;
                background: white;
            }
            .btn-logout:hover {
                background: #fef2f2;
                border-color: #ef4444;
            }
            
            .btn-delete {
              color: #ef4444;
              border-color: #fecaca;
              background: #fef2f2;
            }
            .btn-delete:hover { background: #fee2e2; border-color: #fca5a5; }
            
            .btn-leave, .btn-close {
              color: #f59e0b;
              border-color: #fde68a;
              background: #fffbeb;
            }
            .btn-leave:hover, .btn-close:hover { background: #fef3c7; }
            
            .btn-reopen {
              color: var(--retro-green);
              border-color: #bbf7d0;
              background: #f0fdf4;
            }
            .btn-reopen:hover { background: #dcfce7; }
            
            .online-indicator {
              width: 8px;
              height: 8px;
              background: var(--retro-green);
              border-radius: 50%;
              box-shadow: 0 0 0 2px #d1fae5;
            }
            
            .participants-dropdown { position: relative; }
            .participants-list {
              position: absolute;
              top: 100%;
              right: 0;
              margin-top: 0.5rem;
              background: white;
              border: 1px solid var(--border-color);
              border-radius: 12px;
              min-width: 280px;
              max-height: 300px;
              overflow-y: auto;
              z-index: 100;
              box-shadow: var(--shadow-lg);
            }
            .participants-header {
              padding: 0.75rem 1rem;
              border-bottom: 1px solid var(--border-color);
              font-weight: 600;
              font-size: 0.85rem;
              background: #f9fafb;
              color: var(--text-secondary);
            }
            .participant-item {
              display: flex;
              align-items: center;
              gap: 0.8rem;
              padding: 0.75rem 1rem;
              font-size: 0.9rem;
              color: #374151;
              border-bottom: 1px solid #f3f4f6;
            }
            .participant-item:last-child { border-bottom: none; }
            .participant-item:hover { background: #f9fafb; }
            
            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              flex-shrink: 0;
            }
            .status-dot.online {
              background: var(--retro-green);
              box-shadow: 0 0 0 2px #d1fae5;
            }
            .status-dot.offline { background: #9ca3af; }
            
            .participant-name {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              flex: 1;
              font-weight: 500;
            }
            .role-badge, .you-badge {
              font-size: 0.65rem;
              padding: 0.15rem 0.5rem;
              border-radius: 10px;
              text-transform: uppercase;
              font-weight: 700;
            }
            .role-badge.facilitator { background: #eff6ff; color: var(--accent-color); border: 1px solid #bfdbfe; }
            .role-badge.observer { background: #fff7ed; color: #f97316; border: 1px solid #fed7aa; }
            .you-badge { background: #f3f4f6; color: #4b5563; border: 1px solid #e5e7eb; }
            
            .role-select {
              background: white;
              border: 1px solid var(--border-color);
              color: #374151;
              padding: 0.2rem 0.5rem;
              border-radius: 6px;
              font-size: 0.75rem;
              cursor: pointer;
            }
            
            .user-menu {
              display: flex;
              align-items: center;
              gap: 1rem;
              padding-left: 1rem;
              border-left: 1px solid var(--border-color);
              height: 32px;
            }
            .user-name {
              font-size: 0.9rem;
              font-weight: 600;
              color: #374151;
            }
            
            .modal-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.5);
              backdrop-filter: blur(2px);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
            }
            .modal-content {
              background: white;
              border: 1px solid var(--border-color);
              border-radius: 16px;
              padding: 2rem;
              max-width: 400px;
              width: 90%;
              box-shadow: var(--shadow-lg);
            }
            .modal-content h3 { margin: 0 0 1rem; font-size: 1.25rem; color: #111827; }
            .modal-content p {
              margin: 0 0 1.5rem;
              color: #4b5563;
              font-size: 1rem;
              line-height: 1.5;
            }
            .modal-actions {
              display: flex;
              gap: 1rem;
              justify-content: flex-end;
            }
            .btn-cancel, .btn-confirm-delete {
              padding: 0.6rem 1.2rem;
              border-radius: 8px;
              cursor: pointer;
              font-size: 0.95rem;
              font-weight: 500;
              transition: all 0.2s;
            }
            .btn-cancel {
              background: white;
              border: 1px solid #d1d5db;
              color: #374151;
            }
            .btn-confirm-delete {
              background: #ef4444;
              border: none;
              color: white;
              font-weight: 600;
            }
            .btn-cancel:hover { background: #f9fafb; border-color: #9ca3af; }
            .btn-confirm-delete:hover { background: #dc2626; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3); }
          `}</style>
        </div>
      ) : urlRoomId ? (
        <JoinPage roomId={urlRoomId} />
      ) : (
        <Dashboard onShowMyRetros={() => setShowMyRetros(true)} />
      )}
    </div>
  )
}

// Main App with providers
function App() {
  const { accessToken, isLoading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="spinner"></div>
        </div>
        <style>{`
          .loading-screen {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
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

  // Check if there's a room URL - allow guest access
  const queryParams = new URLSearchParams(window.location.search);
  const urlRoomId = queryParams.get('room');

  // If not authenticated and no room URL and not in guest mode, show auth
  if (!accessToken && !urlRoomId && !isGuestMode) {
    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginPage 
        onSwitchToRegister={() => setAuthView('register')}
        onContinueAsGuest={() => setIsGuestMode(true)}
      />
    );
  }

  return (
    <SocketProvider authToken={accessToken}>
      <RoomProvider>
        <AppContent />
      </RoomProvider>
    </SocketProvider>
  );
}

export default App
