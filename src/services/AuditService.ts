
export interface AuditEvent {
    id: string;
    timestamp: number;
    actorId: number | string;
    actorName: string;
    employeeId?: number;
    employeeName?: string;
    action: string; // ej: 'SYNC_SUCCESS', 'INCIDENT_CREATED', 'DOC_APPROVED'
    description: string;
    metadata?: any;
    status: 'success' | 'error' | 'pending' | 'warning';
    module: 'SYNC' | 'HR_PORTAL' | 'EMPLOYEE_PORTAL' | 'SYSTEM';
}

const STORAGE_KEY = 'hr_app_audit_trail';
const MAX_EVENTS = 500; // Límite para no saturar localStorage

type AuditListener = (event: AuditEvent) => void;

export const AuditService = {
    listeners: [] as AuditListener[],

    load(): AuditEvent[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error loading audit trail", e);
            return [];
        }
    },

    save(events: AuditEvent[]) {
        try {
            const trimmed = events.slice(0, MAX_EVENTS);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch (e) {
            console.error("Error saving audit trail", e);
        }
    },

    log(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
        const fullEvent: AuditEvent = {
            ...event,
            id: 'AUDIT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            timestamp: Date.now()
        };

        const current = this.load();
        const updated = [fullEvent, ...current];
        this.save(updated);

        // Notificar a componentes visuales (Live update)
        this.listeners.forEach(l => l(fullEvent));
    },

    getEventsByEmployee(employeeId: number): AuditEvent[] {
        const events = this.load();
        return events.filter(e => e.employeeId === employeeId || e.actorId === employeeId);
    },

    getAllEvents(): AuditEvent[] {
        return this.load();
    },

    subscribe(listener: AuditListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    clear() {
        localStorage.removeItem(STORAGE_KEY);
        this.listeners.forEach(l => l({
            id: 'clear', timestamp: Date.now(), actorId: 0, actorName: 'System',
            action: 'CLEAR_LOGS', description: 'Auditoría purgada', status: 'warning', module: 'SYSTEM'
        }));
    }
};
