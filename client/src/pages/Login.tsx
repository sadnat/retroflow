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
                    background: var(--bg-color);
                }
                .auth-container {
                    width: 100%;
                    max-width: 400px;
                    background: var(--panel-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 2.5rem;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
                }
                .auth-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .auth-header h1 {
                    margin: 0 0 0.5rem;
                    font-size: 2rem;
                    background: linear-gradient(135deg, var(--accent-color), #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-weight: 800;
                }
                .auth-header p {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 0.95rem;
                }
                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.2rem;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }
                .form-group input {
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: white;
                    color: var(--text-primary);
                    font-size: 1rem;
                    transition: all 0.2s;
                }
                .form-group input:focus {
                    outline: none;
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 3px var(--accent-glow);
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
                    margin-top: 0.5rem;
                    transition: background 0.2s;
                }
                .btn-primary:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .auth-error {
                    padding: 0.75rem 1rem;
                    background: #fef2f2;
                    border: 1px solid #fee2e2;
                    border-radius: 8px;
                    color: #ef4444;
                    font-size: 0.9rem;
                }
                .auth-footer {
                    margin-top: 2rem;
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
                    font-weight: 500;
                    text-decoration: none;
                }
                .link-button:hover {
                    text-decoration: underline;
                }
                .guest-option {
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid var(--border-color);
                }
            `}</style>
        </div>
    );
};
