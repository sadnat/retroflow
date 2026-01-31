import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

interface LoginPageProps {
    onSwitchToRegister: () => void;
    onContinueAsGuest?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister, onContinueAsGuest }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.message || t.auth.loginError);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <h1>{t.app.title}</h1>
                    <p>{t.auth.login} to access your retrospectives</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email">{t.auth.email}</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">{t.auth.password}</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={isLoading}>
                        {isLoading ? t.app.loading : t.auth.login}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        {t.auth.noAccount}{' '}
                        <button onClick={onSwitchToRegister} className="link-button">
                            {t.auth.register}
                        </button>
                    </p>
                    {onContinueAsGuest && (
                        <p className="guest-option">
                            <button onClick={onContinueAsGuest} className="link-button">
                                {t.auth.orContinueAsGuest}
                            </button>
                        </p>
                    )}
                </div>
            </div>

            <style>{`
                .auth-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    background: var(--bg-primary);
                }
                .auth-container {
                    width: 100%;
                    max-width: 400px;
                    background: var(--panel-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 2rem;
                }
                .auth-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .auth-header h1 {
                    margin: 0 0 0.5rem;
                    font-size: 2rem;
                    background: linear-gradient(135deg, var(--accent-color), #9c27b0);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .auth-header p {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                .form-group input {
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.05);
                    color: white;
                    font-size: 1rem;
                }
                .form-group input:focus {
                    outline: none;
                    border-color: var(--accent-color);
                }
                .btn-primary {
                    padding: 0.75rem 1.5rem;
                    background: var(--accent-color);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    margin-top: 0.5rem;
                }
                .btn-primary:hover:not(:disabled) {
                    opacity: 0.9;
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .auth-error {
                    padding: 0.75rem 1rem;
                    background: rgba(244, 67, 54, 0.1);
                    border: 1px solid rgba(244, 67, 54, 0.3);
                    border-radius: 8px;
                    color: #f44336;
                    font-size: 0.9rem;
                }
                .auth-footer {
                    margin-top: 1.5rem;
                    text-align: center;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
                .auth-footer p {
                    margin: 0.5rem 0;
                }
                .link-button {
                    background: none;
                    border: none;
                    color: var(--accent-color);
                    cursor: pointer;
                    font-size: inherit;
                    text-decoration: underline;
                }
                .link-button:hover {
                    opacity: 0.8;
                }
                .guest-option {
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color);
                }
            `}</style>
        </div>
    );
};
