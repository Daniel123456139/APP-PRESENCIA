
import React, { useEffect, useState } from 'react';
import { RealtimeNotificationsService, ConnectionStatus } from '../../services/realtimeNotificationsService';

const ConnectionStatusIndicator: React.FC = () => {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');

    useEffect(() => {
        // Suscribirse a cambios
        RealtimeNotificationsService.onStatusChange((newStatus) => {
            setStatus(newStatus);
        });
    }, []);

    const getConfig = () => {
        switch(status) {
            case 'connected': return { color: 'bg-green-500', text: 'Conectado a tiempo real' };
            case 'connecting': return { color: 'bg-amber-500 animate-pulse', text: 'Reconectando...' };
            case 'disconnected': return { color: 'bg-red-500', text: 'Desconectado (Modo Offline)' };
        }
    };

    const { color, text } = getConfig();

    return (
        <div className="group relative flex items-center">
            <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${color}`} aria-label={text}></div>
            {/* Tooltip */}
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block w-max px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg z-50">
                {text}
            </div>
        </div>
    );
};

export default ConnectionStatusIndicator;
