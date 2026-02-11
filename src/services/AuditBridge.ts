
import { SyncService } from './syncService';
import { AuditService } from './AuditService';

let isInitialized = false;

export const AuditBridge = {
    init() {
        if (isInitialized) return;
        isInitialized = true;

        console.log("🔒 AuditBridge Initialized: Listening to System Events");

        // Suscribirse a eventos del SyncService
        SyncService.subscribe((event) => {
            let status: 'success' | 'error' | 'pending' = 'success';
            if (event.type === 'SYNC_ERROR') status = 'error';
            if (event.type === 'SYNC_QUEUED') status = 'pending';

            AuditService.log({
                actorId: 'SYSTEM',
                actorName: event.user || 'Sistema',
                action: event.type,
                description: event.message,
                metadata: event.payload,
                status: status,
                module: 'SYNC',
                employeeId: (event.payload as any)?.IDOperario,
                employeeName: (event.payload as any)?.DescOperario
            });
        });
    }
};
