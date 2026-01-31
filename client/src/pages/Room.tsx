import React from 'react';
import { useRoom } from '../context/RoomContext';

export const RoomPage: React.FC = () => {
    const { room } = useRoom();

    if (!room) return null;

    return (
        <div className="room-container">
            {/* Detailed phase views will be implemented here */}
        </div>
    );
};
