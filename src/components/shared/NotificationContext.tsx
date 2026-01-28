
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { NotificationPersistence, StoredNotification } from '../../services/notificationPersistence';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
    id: number;
    type: NotificationType;
    message: string;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType) => void;
    // Nuevas propiedades para el historial (Opcionales para no romper tipos si se usa mock antiguo)
    history: StoredNotification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearHistory: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Estado para los Toasts efímeros (API antigua intacta)
    const [toasts, setToasts] = useState<Notification[]>([]);

    // Estado para el Historial Persistente (Nueva funcionalidad)
    const [history, setHistory] = useState<StoredNotification[]>([]);

    // Cargar historial al montar
    useEffect(() => {
        setHistory(NotificationPersistence.load());
    }, []);

    const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
        // 1. Lógica Original: Mostrar Toast
        const id = Date.now() + Math.random(); // Ensure uniqueness even if called in same ms
        setToasts((prev) => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((n) => n.id !== id));
        }, 5000);

        // 2. Nueva Lógica: Guardar en Historial
        const updatedHistory = NotificationPersistence.add({
            id: String(id),
            message,
            type
        });
        setHistory(updatedHistory);
    }, []);

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((n) => n.id !== id));
    };

    // Funciones del historial
    const markAsRead = (id: string) => {
        const updated = NotificationPersistence.markAsRead(id);
        setHistory(updated);
    };

    const markAllAsRead = () => {
        const updated = NotificationPersistence.markAllAsRead();
        setHistory(updated);
    };

    const clearHistory = () => {
        const updated = NotificationPersistence.clear();
        setHistory(updated);
    };

    const unreadCount = history.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{
            showNotification,
            history,
            unreadCount,
            markAsRead,
            markAllAsRead,
            clearHistory
        }}>
            {children}
            {/* Contenedor de Toasts con z-index alto y pointer-events-none para no bloquear */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map((notification) => (
                    <div
                        key={notification.id}
                        onClick={() => removeToast(notification.id)}
                        className={`pointer-events-auto cursor-pointer flex items-center w-full max-w-sm overflow-hidden bg-white rounded-lg shadow-xl border-l-4 animate-fadeIn transition-all duration-300 ${notification.type === 'success' ? 'border-green-500' :
                                notification.type === 'error' ? 'border-red-500' :
                                    notification.type === 'warning' ? 'border-amber-500' : 'border-blue-500'
                            }`}
                    >
                        <div className="px-4 py-3 w-full">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    {notification.type === 'success' && <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                    {notification.type === 'error' && <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>}
                                    {notification.type === 'warning' && <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                                    {notification.type === 'info' && <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                </div>
                                <div className="ml-3 w-0 flex-1 pt-0.5">
                                    <p className="text-sm font-medium text-gray-900">{notification.message}</p>
                                </div>
                                <div className="ml-4 flex-shrink-0 flex">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeToast(notification.id); }}
                                        className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none transition ease-in-out duration-150 p-1.5 hover:bg-slate-100 rounded-md"
                                    >
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
