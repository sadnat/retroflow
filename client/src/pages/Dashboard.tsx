import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

interface DashboardProps {
    onShowMyRetros?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onShowMyRetros }) => {
    const { createRoom } = useRoom();
    const { user, isAuthenticated, logout } = useAuth();
    const [retroName, setRetroName] = useState('');
    const [facilitatorName, setFacilitatorName] = useState(user?.name || '');
    const [template, setTemplate] = useState('CLASSIC');
    const [password, setPassword] = useState('');
    const [maxPostits, setMaxPostits] = useState<number | undefined>(undefined);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!retroName || !facilitatorName) return;

        if (!isAuthenticated) {
            setError(t.errors.notAuthorized);
            return;
        }

        setLoading(true);
        setError('');
        try {
            await createRoom({
                name: retroName,
                template,
                facilitatorName,
                password: password || undefined,
                maxPostitsPerUser: maxPostits,
            });
        } catch (err: any) {
            setError(err || 'Failed to create room');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-page">
            {isAuthenticated && (
                <div className="dashboard-header">
                    <span>{t.dashboard.welcome.replace('RetroFlow', '')}{user?.name}</span>
                    <div className="header-actions">
                        {onShowMyRetros && (
                            <button onClick={onShowMyRetros} className="btn-secondary">
                                {t.dashboard.myRetros}
                            </button>
                        )}
                        <button onClick={logout} className="btn-logout">
                            {t.auth.logout}
                        </button>
                    </div>
                </div>
            )}

            <div className="dashboard-container glass">
                <h1>{t.app.title}</h1>
                <p className="subtitle">{t.app.subtitle}</p>

                {!isAuthenticated && (
                    <div className="guest-warning">
                        {t.auth.orContinueAsGuest}. {t.auth.login} to create retrospectives and access your history.
                    </div>
                )}

                <form onSubmit={handleCreate} className="create-form">
                    <div className="form-group">
                        <label>{t.dashboard.roomName}</label>
                        <input
                            type="text"
                            placeholder="e.g., Sprint 42 - Team Avengers"
                            value={retroName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetroName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>{t.dashboard.yourName} ({t.room.facilitator})</label>
                        <input
                            type="text"
                            placeholder="Alice"
                            value={facilitatorName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFacilitatorName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>{t.dashboard.template}</label>
                        <div className="template-grid">
                            <div
                                className={`template-card ${template === 'CLASSIC' ? 'selected' : ''}`}
                                onClick={() => setTemplate('CLASSIC')}
                            >
                                <h3>Classic</h3>
                                <p>Well / Not Well / Actions</p>
                            </div>
                            <div
                                className={`template-card ${template === 'STARFISH' ? 'selected' : ''}`}
                                onClick={() => setTemplate('STARFISH')}
                            >
                                <h3>Starfish</h3>
                                <p>Keep / Start / Stop / ...</p>
                            </div>
                        </div>
                    </div>

                    {/* Advanced options */}
                    <button 
                        type="button" 
                        className="btn-advanced"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        {showAdvanced ? 'Hide' : 'Show'} {t.dashboard.advancedOptions.toLowerCase()}
                    </button>

                    {showAdvanced && (
                        <div className="advanced-options">
                            <div className="form-group">
                                <label>{t.dashboard.password}</label>
                                <input
                                    type="password"
                                    placeholder="Leave empty for open room"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <span className="form-hint">Protect your room with a password</span>
                            </div>

                            <div className="form-group">
                                <label>{t.dashboard.maxPostits}</label>
                                <select
                                    value={maxPostits || ''}
                                    onChange={(e) => setMaxPostits(e.target.value ? parseInt(e.target.value) : undefined)}
                                >
                                    <option value="">Unlimited</option>
                                    <option value="3">3 post-its</option>
                                    <option value="5">5 post-its</option>
                                    <option value="10">10 post-its</option>
                                    <option value="15">15 post-its</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {error && <p className="error-message">{error}</p>}

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading || !isAuthenticated}
                    >
                        {loading ? t.app.loading : t.dashboard.create}
                    </button>

                    {!isAuthenticated && (
                        <p className="login-hint">
                            <a href="/" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
                                {t.auth.login}
                            </a> to create a retrospective
                        </p>
                    )}
                </form>
            </div>

            <style>{`
        .dashboard-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .dashboard-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--panel-bg);
          border-bottom: 1px solid var(--border-color);
        }
        .header-actions {
          display: flex;
          gap: 1rem;
        }
        .btn-secondary, .btn-logout {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border-color);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .btn-secondary:hover, .btn-logout:hover {
          background: rgba(255,255,255,0.2);
        }
        .dashboard-container {
          padding: 3rem;
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          text-align: left;
        }
        .subtitle {
          color: var(--text-secondary);
          margin-bottom: 2rem;
        }
        .guest-warning {
          padding: 1rem;
          background: rgba(255, 152, 0, 0.1);
          border: 1px solid rgba(255, 152, 0, 0.3);
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          color: #ff9800;
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
        input, select {
          padding: 0.8rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: white;
          font-size: 1rem;
        }
        select {
          cursor: pointer;
        }
        .form-hint {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .template-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .template-card {
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .template-card:hover { border-color: var(--accent-color); }
        .template-card.selected {
          border-color: var(--accent-color);
          background: rgba(47, 129, 247, 0.1);
        }
        .template-card h3 { margin: 0; font-size: 1rem; }
        .template-card p { margin: 0.5rem 0 0; font-size: 0.8rem; color: var(--text-secondary); }
        
        .btn-advanced {
          background: none;
          border: none;
          color: var(--accent-color);
          cursor: pointer;
          font-size: 0.9rem;
          text-align: left;
          padding: 0;
        }
        .btn-advanced:hover {
          text-decoration: underline;
        }
        .advanced-options {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
          border: 1px solid var(--border-color);
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
          margin-top: 1rem;
        }
        .btn-primary:disabled { 
          opacity: 0.5; 
          cursor: not-allowed;
        }
        
        .login-hint {
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin: 0;
        }
        .login-hint a {
          color: var(--accent-color);
        }
        
        .glass {
          background: var(--panel-bg);
          backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .error-message { color: var(--retro-red); font-size: 0.8rem; }
      `}</style>
        </div>
    );
};
