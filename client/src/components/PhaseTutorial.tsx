import React, { useState, useEffect } from 'react';
import { Phase } from '../../../shared/types';
import { t } from '../i18n';

interface PhaseTutorialProps {
    phase: Phase;
    onDismiss?: () => void;
}

const STORAGE_KEY = 'retroflow_tutorials_dismissed';

const getDismissedTutorials = (): string[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const setDismissedTutorial = (phase: string, dismissed: boolean) => {
    const current = getDismissedTutorials();
    if (dismissed && !current.includes(phase)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, phase]));
    } else if (!dismissed && current.includes(phase)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter(p => p !== phase)));
    }
};

export const PhaseTutorial: React.FC<PhaseTutorialProps> = ({ phase, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const tutorial = t.tutorials[phase];

    useEffect(() => {
        const dismissed = getDismissedTutorials();
        const shouldShow = !dismissed.includes(phase);
        setIsVisible(shouldShow);
        setIsMinimized(!shouldShow);
    }, [phase]);

    const handleDismiss = () => {
        setIsVisible(false);
        setIsMinimized(true);
        onDismiss?.();
    };

    const handleDontShowAgain = () => {
        setDismissedTutorial(phase, true);
        setIsVisible(false);
        setIsMinimized(true);
        onDismiss?.();
    };

    const handleShowAgain = () => {
        setDismissedTutorial(phase, false);
        setIsVisible(true);
        setIsMinimized(false);
    };

    if (!tutorial) return null;

    return (
        <>
            {isMinimized && !isVisible && (
                <button className="tutorial-show-btn" onClick={handleShowAgain} title={t.tutorials.showAgain}>
                    ?
                </button>
            )}

            {isVisible && (
                <div className="tutorial-overlay">
                    <div className="tutorial-card">
                        <div className="tutorial-header">
                            <div className="tutorial-phase-badge">{t.phases[phase]}</div>
                            <button className="tutorial-close" onClick={handleDismiss}>×</button>
                        </div>
                        
                        <h2 className="tutorial-title">{tutorial.title}</h2>
                        <p className="tutorial-description">{tutorial.description}</p>
                        
                        <div className="tutorial-tips">
                            <h4>Tips:</h4>
                            <ul>
                                {tutorial.tips.map((tip, index) => (
                                    <li key={index}>{tip}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="tutorial-actions">
                            <button className="btn-got-it" onClick={handleDismiss}>
                                {t.tutorials.gotIt}
                            </button>
                            <button className="btn-dont-show" onClick={handleDontShowAgain}>
                                {t.tutorials.dontShowAgain}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .tutorial-show-btn {
                    position: fixed;
                    bottom: 1.5rem;
                    right: 1.5rem;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    font-size: 1.2rem;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                    z-index: 100;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .tutorial-show-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
                }

                .tutorial-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(5px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .tutorial-card {
                    background: var(--panel-bg, #1a1a2e);
                    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
                    border-radius: 16px;
                    padding: 2rem;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .tutorial-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .tutorial-phase-badge {
                    background: var(--accent-color);
                    color: white;
                    padding: 0.3rem 0.8rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .tutorial-close {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
                    font-size: 1.5rem;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s, color 0.2s;
                }
                .tutorial-close:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .tutorial-title {
                    margin: 0 0 0.75rem 0;
                    font-size: 1.5rem;
                    color: var(--text-primary, white);
                }

                .tutorial-description {
                    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
                    line-height: 1.6;
                    margin: 0 0 1.5rem 0;
                }

                .tutorial-tips {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }

                .tutorial-tips h4 {
                    margin: 0 0 0.75rem 0;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    color: var(--accent-color);
                    letter-spacing: 0.5px;
                }

                .tutorial-tips ul {
                    margin: 0;
                    padding-left: 1.2rem;
                }

                .tutorial-tips li {
                    color: var(--text-secondary, rgba(255, 255, 255, 0.8));
                    margin-bottom: 0.5rem;
                    line-height: 1.4;
                }
                .tutorial-tips li:last-child {
                    margin-bottom: 0;
                }

                .tutorial-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                }

                .btn-got-it {
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .btn-got-it:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px var(--accent-glow, rgba(99, 102, 241, 0.4));
                }

                .btn-dont-show {
                    background: transparent;
                    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
                    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: background 0.2s, color 0.2s;
                }
                .btn-dont-show:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-primary, white);
                }

                @media (max-width: 600px) {
                    .tutorial-card {
                        padding: 1.5rem;
                    }
                    .tutorial-title {
                        font-size: 1.25rem;
                    }
                    .tutorial-actions {
                        flex-direction: column;
                    }
                    .btn-got-it, .btn-dont-show {
                        width: 100%;
                        text-align: center;
                    }
                }
            `}</style>
        </>
    );
};
