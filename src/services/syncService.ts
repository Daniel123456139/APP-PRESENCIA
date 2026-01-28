import { RawDataRow } from '../types';
import { insertFichaje, deleteFichajesRange, updateFichaje, uploadFichaje } from './apiService';
import { dbService, QUEUE_STORE } from './dbService';

const QUEUE_KEY = 'hr_app_sync_queue'; // For migration
const AUDIT_LOG_KEY = 'hr_app_audit_log';

type QueueActionType = 'INSERT_FICHAJE' | 'DELETE_RANGE' | 'UPDATE_FICHAJE' | 'UPLOAD_FICHAJE';

export interface QueuedAction {
    id: string;
    timestamp: number;
    type: QueueActionType;
    payload: Record<string, unknown> | Partial<RawDataRow>; // Flexible para acomodar diferentes payloads
    user: string;
    status: 'pending' | 'failed';
    retryCount: number;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    action: string;
    details: string;
    user: string;
    status: 'Success' | 'Queued' | 'Error';
}

// Tipos para el sistema de suscripción de auditoría
type SyncEventType = 'SYNC_SUCCESS' | 'SYNC_ERROR' | 'SYNC_QUEUED' | 'QUEUE_PROCESSED';
interface SyncEvent {
    type: SyncEventType;
    message: string;
    payload?: unknown;
    user?: string;
}
type SyncListener = (event: SyncEvent) => void;

export const SyncService = {
    listeners: [] as SyncListener[],
    _initialized: false,

    async _ensureInitialized() {
        if (this._initialized) return;

        // Migration logic
        try {
            const oldQueue = localStorage.getItem(QUEUE_KEY);
            if (oldQueue) {
                const parsed = JSON.parse(oldQueue) as QueuedAction[];
                for (const item of parsed) {
                    await dbService.put(QUEUE_STORE, item);
                }
                localStorage.removeItem(QUEUE_KEY);
                console.log("✅ Sync Queue migrated to IndexedDB");
            }
        } catch (e) {
            console.error("Migration error", e);
        }

        this._initialized = true;
    },

    // --- Subscription Management ---
    subscribe(listener: SyncListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notify(event: SyncEvent) {
        this.listeners.forEach(l => l(event));
    },

    // --- Queue Management ---

    async getQueue(): Promise<QueuedAction[]> {
        await this._ensureInitialized();
        return dbService.getAll<QueuedAction>(QUEUE_STORE);
    },

    async addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount' | 'status'>) {
        await this._ensureInitialized();
        const newAction: QueuedAction = {
            ...action,
            id: `q - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending'
        };

        await dbService.put(QUEUE_STORE, newAction);

        this.logAudit({
            action: 'Queue Add',
            details: `Encolado acción ${action.type} `,
            user: action.user,
            status: 'Queued'
        });

        // Notificar que hay cambios en la cola (para UI de SyncStatus)
        this.notify({
            type: 'SYNC_QUEUED',
            message: 'Acción añadida a la cola offline',
            payload: newAction,
            user: action.user
        });

        return newAction;
    },

    async removeFromQueue(id: string) {
        await dbService.delete(QUEUE_STORE, id);
    },

    async clearQueue() {
        await dbService.clear(QUEUE_STORE);
    },

    // --- Processing ---

    async processQueue(onItemSuccess?: (item: QueuedAction) => void): Promise<{ success: number, failed: number }> {
        await this._ensureInitialized();
        const queue = await this.getQueue();
        if (queue.length === 0) return { success: 0, failed: 0 };

        let successCount = 0;
        let failedCount = 0;

        for (const item of queue) {
            try {
                if (item.type === 'INSERT_FICHAJE') {
                    await insertFichaje(item.payload as Partial<RawDataRow>, item.user);
                } else if (item.type === 'DELETE_RANGE') {
                    const payload = item.payload as { idOperario: number, motivoId: number, fechaInicio: string, fechaFin: string };
                    const { idOperario, motivoId, fechaInicio, fechaFin } = payload;
                    await deleteFichajesRange(idOperario, motivoId, fechaInicio, fechaFin);
                } else if (item.type === 'UPDATE_FICHAJE') {
                    await updateFichaje(item.payload as Partial<RawDataRow>, item.user);
                } else if (item.type === 'UPLOAD_FICHAJE') {
                    await uploadFichaje(item.payload as Partial<RawDataRow>, item.user);
                }

                successCount++;
                if (onItemSuccess) onItemSuccess(item);

                // Success! Remove from IDB
                await this.removeFromQueue(item.id);

                this.logAudit({
                    action: 'Queue Sync',
                    details: `Sincronizada acción ${item.type} `,
                    user: 'System',
                    status: 'Success'
                });

                // Notify Bridge
                this.notify({
                    type: 'QUEUE_PROCESSED',
                    message: `Cola procesada: ${item.type} `,
                    payload: item.payload,
                    user: 'System'
                });

            } catch (error) {
                console.error(`Failed to process item ${item.id} `, error);
                item.retryCount++;
                item.status = 'failed';
                // Update item in IDB with failed status and retryCount
                await dbService.put(QUEUE_STORE, item);
                failedCount++;
            }
        }

        return { success: successCount, failed: failedCount };
    },

    // --- High Level Operations Helpers ---

    async handleOperationResult(
        operationPromise: Promise<unknown>,
        actionType: QueueActionType,
        payload: Record<string, unknown> | Partial<RawDataRow>,
        user: string,
        successMsg: string
    ): Promise<{ success: boolean, queued: boolean, message: string }> {
        try {
            await operationPromise;

            this.logAudit({
                action: actionType,
                details: `${successMsg} (Directo)`,
                user: user,
                status: 'Success'
            });

            this.notify({
                type: 'SYNC_SUCCESS',
                message: successMsg,
                payload: payload,
                user: user
            });

            return { success: true, queued: false, message: 'Operación exitosa.' };

        } catch (error: unknown) {
            const errorMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();

            // Detección de error de conexión (Offline / Fallo de Red)
            const isNetworkError =
                error instanceof TypeError && errorMsg.includes('fetch') ||
                errorMsg.includes('network') ||
                errorMsg.includes('conexión') ||
                errorMsg.includes('failed to fetch') ||
                errorMsg.includes('timeout');

            if (isNetworkError || !navigator.onLine) {
                await this.addToQueue({
                    type: actionType,
                    payload: payload,
                    user: user
                });

                return { success: false, queued: true, message: 'Sin conexión. Guardado en cola.' };
            }

            this.logAudit({
                action: `${actionType} Fail`,
                details: `Fallo(No recuperable): ${error instanceof Error ? error.message : 'Error desconocido'} `,
                user: user,
                status: 'Error'
            });

            this.notify({
                type: 'SYNC_ERROR',
                message: `Error ERP: ${error instanceof Error ? error.message : 'Error desconocido'} `,
                payload: payload,
                user: user
            });

            return { success: false, queued: false, message: (error instanceof Error ? error.message : 'Error desconocido') };
        }
    },

    // --- Public Operations ---

    async tryInsertFichaje(fichaje: Partial<RawDataRow>, user: string) {
        return this.handleOperationResult(
            insertFichaje(fichaje, user),
            'INSERT_FICHAJE',
            fichaje,
            user,
            `Fichaje insertado: ${fichaje.DescMotivoAusencia || 'Registro'} `
        );
    },

    async tryUpdateFichaje(fichaje: Partial<RawDataRow>, user: string) {
        return this.handleOperationResult(
            updateFichaje(fichaje, user),
            'UPDATE_FICHAJE',
            fichaje,
            user,
            `Fichaje actualizado ID: ${fichaje.IDControlPresencia} `
        );
    },

    async tryUploadFichaje(fichaje: Partial<RawDataRow>, user: string) {
        return this.handleOperationResult(
            uploadFichaje(fichaje, user),
            'UPLOAD_FICHAJE',
            fichaje,
            user,
            `Fichaje modificado(Upload) ID: ${fichaje.IDControlPresencia} `
        );
    },

    async tryDeleteRange(payload: { idOperario: number, motivoId: number, fechaInicio: string, fechaFin: string }, user: string) {
        return this.handleOperationResult(
            deleteFichajesRange(payload.idOperario, payload.motivoId, payload.fechaInicio, payload.fechaFin),
            'DELETE_RANGE',
            payload,
            user,
            `Rango eliminado: ${payload.fechaInicio} - ${payload.fechaFin} `
        );
    },

    // --- Audit Logging (Still in localStorage for now, but limited) ---

    getAuditLog(): AuditLog[] {
        try {
            const logs = localStorage.getItem(AUDIT_LOG_KEY);
            return logs ? JSON.parse(logs) : [];
        } catch {
            return [];
        }
    },

    logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
        const logs = this.getAuditLog();
        const newLog: AuditLog = {
            ...entry,
            id: `log - ${Date.now()} `,
            timestamp: new Date().toISOString()
        };
        // Keep only last 100 logs
        const updatedLogs = [newLog, ...logs].slice(0, 100);
        localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updatedLogs));
    }
};
