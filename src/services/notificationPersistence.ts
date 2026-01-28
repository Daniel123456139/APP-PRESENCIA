
export interface StoredNotification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    timestamp: number;
    read: boolean;
}

const STORAGE_KEY = 'hr_app_notifications_history';
const MAX_HISTORY = 50;

export const NotificationPersistence = {
    load(): StoredNotification[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading notifications:', error);
            return [];
        }
    },

    save(notifications: StoredNotification[]): void {
        try {
            // Limitamos el historial para no saturar el localStorage
            const trimmed = notifications.slice(0, MAX_HISTORY);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch (error) {
            console.error('Error saving notifications:', error);
        }
    },

    add(notification: Omit<StoredNotification, 'read' | 'timestamp'>): StoredNotification[] {
        const current = this.load();
        const newEntry: StoredNotification = {
            ...notification,
            timestamp: Date.now(),
            read: false
        };
        
        // Añadir al principio
        const updated = [newEntry, ...current];
        this.save(updated);
        return updated;
    },

    markAsRead(id: string): StoredNotification[] {
        const current = this.load();
        const updated = current.map(n => 
            n.id === id ? { ...n, read: true } : n
        );
        this.save(updated);
        return updated;
    },

    markAllAsRead(): StoredNotification[] {
        const current = this.load();
        const updated = current.map(n => ({ ...n, read: true }));
        this.save(updated);
        return updated;
    },

    clear(): StoredNotification[] {
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
};
