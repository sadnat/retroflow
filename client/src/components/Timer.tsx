import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { useSocket } from '../context/SocketContext';

export const Timer: React.FC = () => {
    const { room, odlUserId: userId } = useRoom();
    const { socket } = useSocket();
    const [inputMinutes, setInputMinutes] = useState(5);

    const isFacilitator = room?.facilitatorId === userId;

    const handleStart = () => {
        socket?.emit('timer:start', { roomId: room?.id, duration: inputMinutes * 60 });
    };

    const handleStop = () => {
        socket?.emit('timer:stop', { roomId: room?.id });
    };

    if (!room) return null;

    const remaining = room.timer?.remaining || 0;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const isRunning = room.timer?.isRunning;

    return (
        <div className="timer-container">
            {isRunning ? (
                <div className={`timer-display ${remaining < 30 ? 'urgent' : ''}`}>
                    <span>{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
                    {isFacilitator && <button onClick={handleStop} className="btn-icon">⏹</button>}
                </div>
            ) : isFacilitator ? (
                <div className="timer-setup">
                    <input
                        type="number"
                        min="1" max="60"
                        value={inputMinutes}
                        onChange={(e) => setInputMinutes(parseInt(e.target.value))}
                    />
                    <button onClick={handleStart} className="btn-icon">▶</button>
                </div>
            ) : null}

            <style>{`
        .timer-container {
          background: rgba(0,0,0,0.3);
          padding: 0.3rem 0.8rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          font-family: monospace;
          font-weight: bold;
        }
        .timer-display { display: flex; align-items: center; gap: 0.5rem; font-size: 1.2rem; }
        .timer-display.urgent { color: var(--retro-red); animation: pulse 1s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .timer-setup { display: flex; align-items: center; gap: 0.4rem; }
        .timer-setup input { 
          width: 40px; 
          background: transparent; 
          border: none; 
          color: white; 
          text-align: center;
          font-family: inherit;
          font-size: 1rem;
        }
        .btn-icon { background: transparent; border: none; cursor: pointer; color: white; font-size: 1rem; }
      `}</style>
        </div>
    );
};
