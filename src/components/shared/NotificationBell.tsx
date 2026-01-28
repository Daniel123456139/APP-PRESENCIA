
import React, { useState, useRef, useEffect } from 'react';
import { useNotification } from './NotificationContext';
import { StoredNotification } from '../../services/notificationPersistence';

const NotificationBell: React.FC = () => {
    const { history, unreadCount, markAsRead, markAllAsRead, clearHistory } = useNotification();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Cerrar al hacer click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleBellClick = () => {
        setIsOpen(!isOpen);
    };

    const handleNotificationClick = (n: StoredNotification) => {
        if (!n.read) markAsRead(n.id);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />;
            case 'error': return <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />;
            case 'warning': return <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />;
            default: return <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />;
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleBellClick}
                className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
                aria-label="Notificaciones"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full border border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-fadeIn origin-top-right">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-sm font-bold text-slate-800">Notificaciones</h3>
                        <div className="flex gap-2">
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                    Marcar leídas
                                </button>
                            )}
                            <button onClick={clearHistory} className="text-xs text-slate-400 hover:text-slate-600">
                                Borrar
                            </button>
                        </div>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {history.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-sm">
                                No tienes notificaciones.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {history.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => handleNotificationClick(n)}
                                        className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3 ${!n.read ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className="flex-shrink-0 pt-0.5">
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${!n.read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                                {n.message}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {formatTime(n.timestamp)}
                                            </p>
                                        </div>
                                        {!n.read && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
