
import React from 'react';
import NotificationBell from './NotificationBell';
import ServerStatusIndicator from './ServerStatusIndicator';


const GlobalStatusPanel: React.FC = () => {
    return (
        <div className="fixed top-4 right-16 z-40 flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-slate-200/80 transition-all hover:shadow-md">
            {/* Indicador de Servidor ERP (REST API) */}
            <ServerStatusIndicator />



            <div className="h-4 w-px bg-slate-200 mx-1"></div>

            {/* Notificaciones */}
            <NotificationBell />
        </div>
    );
};

export default GlobalStatusPanel;
