import React, { useEffect, useState } from 'react';
import { SyncService, QueuedAction } from '../../services/syncService';

interface SyncStatusIndicatorProps {
    lastUpdated: number;
    isRefetching: boolean;
    error: string | null;
    onManualRefresh: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
    lastUpdated,
    isRefetching,
    error,
    onManualRefresh
}) => {
    // --- Logic for Offline Queue (Existing) ---
    const [queue, setQueue] = useState<QueuedAction[]>([]);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    useEffect(() => {
        const fetchQueue = async () => {
            const q = await SyncService.getQueue();
            setQueue(q);
        };
        fetchQueue();

        const unsubscribe = SyncService.subscribe(async (event) => {
            if (event.type === 'SYNC_QUEUED' || event.type === 'QUEUE_PROCESSED') {
                const q = await SyncService.getQueue();
                setQueue(q);
            }
        });
        return () => unsubscribe();
    }, []);

    const processQueue = async () => {
        if (isProcessingQueue || queue.length === 0) return;
        setIsProcessingQueue(true);
        await SyncService.processQueue();
        const q = await SyncService.getQueue();
        setQueue(q);
        setIsProcessingQueue(false);
    };

    const failedCount = queue.filter(i => i.status === 'failed').length;

    // --- Logic for Freshness (New) ---
    const timeString = new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let freshnessBadgeClass = "bg-gray-100 text-gray-600 border-gray-200";
    let freshnessContent;

    if (error) {
        freshnessContent = (
            <>
                <span className="mr-1">⚠️</span>
                <span>Error de red</span>
            </>
        );
        freshnessBadgeClass = "bg-red-50 text-red-600 border-red-200 cursor-pointer hover:bg-red-100";
    } else if (isRefetching) {
        freshnessContent = (
            <>
                <svg className="animate-spin -ml-1 mr-2 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Sincronizando...</span>
            </>
        );
        freshnessBadgeClass = "bg-blue-50 text-blue-600 border-blue-200";
    } else {
        freshnessContent = (
            <>
                <span className="mr-1 text-green-500">●</span>
                <span>Actualizado {timeString}</span>
            </>
        );
        freshnessBadgeClass = "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 cursor-pointer shadow-sm";
    }

    return (
        <div className="flex items-center gap-2">
            {/* 1. Offline Queue Badge (Visible only if items in queue) */}
            {queue.length > 0 && (
                <button
                    onClick={processQueue}
                    disabled={isProcessingQueue}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all shadow-sm border ${failedCount > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                    title="Haga clic para intentar enviar datos pendientes"
                >
                    {isProcessingQueue ? (
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                    )}
                    {queue.length} Pending
                </button>
            )}

            {/* 2. Freshness Badge (Always Visible now in Sidebar) */}
            <div
                onClick={!isRefetching ? onManualRefresh : undefined}
                className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 select-none ${freshnessBadgeClass}`}
                title={error ? error : "Click para actualizar ahora"}
            >
                {freshnessContent}
            </div>
        </div>
    );
};

export default SyncStatusIndicator;
