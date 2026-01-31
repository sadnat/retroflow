import React from 'react';
import { useRoom } from '../context/RoomContext';
import { useSocket } from '../context/SocketContext';
import { Phase } from '../../../shared/types';
import { t } from '../i18n';

export const PhaseControl: React.FC = () => {
    const { room, odlUserId } = useRoom();
    const { socket } = useSocket();

    if (!room || room.facilitatorId !== odlUserId) return null;

    const phases: Phase[] = [
        'SETUP', 'IDEATION', 'DISCUSSION', 'GROUPING', 'VOTING', 'ACTIONS', 'CONCLUSION'
    ];

    const currentIdx = phases.indexOf(room.phase);

    const handleNext = () => {
        if (currentIdx < phases.length - 1) {
            socket?.emit('phase:change', { roomId: room.id, phase: phases[currentIdx + 1], odlUserId });
        }
    };

    const handlePrev = () => {
        if (currentIdx > 0) {
            socket?.emit('phase:change', { roomId: room.id, phase: phases[currentIdx - 1], odlUserId });
        }
    };

    return (
        <div className="phase-control-wrapper">
            <div className="phase-control">
                <button onClick={handlePrev} disabled={currentIdx === 0} title="Phase précédente">←</button>

                <div className="current-phase-info">
                    <span className="phase-label">{t.phases[room.phase]}</span>
                    <div className="phase-steps">
                        {phases.map((p, i) => (
                            <div
                                key={p}
                                className={`step-dot ${i <= currentIdx ? 'active' : ''} ${i === currentIdx ? 'current' : ''}`}
                                title={t.phases[p]}
                            />
                        ))}
                    </div>
                </div>

                {room.phase === 'IDEATION' ? (
                    <button onClick={handleNext} className="btn-reveal">
                        {t.board.revealIdeas}
                    </button>
                ) : (
                    <button onClick={handleNext} disabled={currentIdx === phases.length - 1} className="btn-next">
                        {t.app.next} →
                    </button>
                )}
            </div>

            <style>{`
        .phase-control-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .phase-control {
          display: flex;
          align-items: center;
          gap: 1.2rem;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.4rem 1rem;
          border-radius: 30px;
          border: 1px solid var(--border-color);
          backdrop-filter: blur(8px);
        }
        .current-phase-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          min-width: 100px;
        }
        .phase-label {
          font-size: 0.7rem;
          font-weight: bold;
          text-transform: uppercase;
          color: var(--accent-color);
          letter-spacing: 0.5px;
        }
        .phase-steps { display: flex; gap: 0.3rem; }
        .step-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-secondary); opacity: 0.2; }
        .step-dot.active { background: var(--accent-color); opacity: 0.6; }
        .step-dot.current { opacity: 1; transform: scale(1.2); background: #fff; }
        
        button {
          background: transparent;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        button:disabled { opacity: 0.2; cursor: not-allowed; }
        
        .btn-next {
          font-weight: 600;
          color: var(--text-primary);
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
        }
        .btn-next:hover:not(:disabled) { color: var(--accent-color); }
        
        .btn-reveal {
          background: var(--accent-color);
          color: white;
          padding: 0.4rem 0.8rem;
          border-radius: 20px;
          font-weight: bold;
          font-size: 0.8rem;
          box-shadow: 0 0 15px var(--accent-glow);
        }
        .btn-reveal:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 20px var(--accent-color);
        }
      `}</style>
        </div>
    );
};
