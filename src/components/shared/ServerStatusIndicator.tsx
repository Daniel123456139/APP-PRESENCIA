
import React from 'react';
import { useServerConnection } from '../../hooks/useServerConnection';

const ServerStatusIndicator: React.FC = () => {
    const { status, latency } = useServerConnection();

    const getConfig = () => {
        switch (status) {
            case 'online':
                return {
                    color: 'bg-emerald-500',
                    pulse: '',
                    text: 'ERP Online',
                    details: latency ? `${latency} ms` : '< 1 ms'
                };
            case 'connecting':
                return {
                    color: 'bg-amber-400',
                    pulse: 'animate-pulse',
                    text: 'Verificando ERP...',
                    details: 'Conectando...'
                };
            case 'offline':
                return {
                    color: 'bg-rose-500',
                    pulse: '',
                    text: 'ERP Desconectado',
                    details: 'Sin conexión con servidor'
                };
        }
    };

    const config = getConfig();

    return (
        <div className="group relative flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 transition-colors cursor-help">
            <div className="relative flex items-center justify-center">
                {status === 'connecting' && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping"></span>
                )}
                <div 
                    className={`w-2.5 h-2.5 rounded-full border border-white/50 shadow-sm ${config.color} ${config.pulse}`} 
                ></div>
            </div>
            
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:block">
                ERP
            </span>

            {/* Tooltip personalizado */}
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block z-50 min-w-[180px]">
                <div className="bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 border border-slate-700">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-200">Estado del Servidor</span>
                        <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
                    </div>
                    <p className="text-slate-400 mb-2">{config.text}</p>
                    
                    <div className="border-t border-slate-700 pt-2 flex justify-between text-[10px] text-slate-500 uppercase font-mono">
                        <span>Latencia</span>
                        <span className="text-slate-300">{config.details}</span>
                    </div>
                </div>
                {/* Flecha del tooltip */}
                <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-800 rotate-45 border-l border-t border-slate-700"></div>
            </div>
        </div>
    );
};

export default ServerStatusIndicator;
