
import { useState, useEffect, useRef, useMemo } from 'react';
import { RawDataRow, ProcessedDataRow, Shift, User } from '../types';
import { processData } from '../services/dataProcessor';
import { trackPerfMetric } from '../services/performanceMonitoringService';

interface WorkerResponse {
    success: boolean;
    data?: ProcessedDataRow[];
    error?: string;
}

export function useProcessDataWorker(
    rawData: RawDataRow[],
    allUsers: User[],
    analysisRange?: { start: Date, end: Date },
    holidays?: Set<string>,
    dataVersion?: number,
    employeeCalendars?: Record<number, Record<string, number>>,
    calendarsKey?: string,
    usersKey?: string
) {
    const [result, setResult] = useState<ProcessedDataRow[]>([]);
    const [status, setStatus] = useState<'idle' | 'processing' | 'error' | 'success'>('idle');
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const prevDataLengthRef = useRef<number>(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const processingTokenRef = useRef<number>(0);
    const WORKER_TIMEOUT_MS = 15000;

    // Safety Refs
    const runSafeCounterRef = useRef<number>(0);
    const lastRunTimeRef = useRef<number>(0);

    // Memoize holidays array to prevent unnecessary re-renders
    const holidaysArray = useMemo(() => {
        return holidays ? Array.from(holidays) : [];
    }, [holidays]);

    // Memoize analysis range key to prevent unnecessary re-renders
    const analysisRangeKey = useMemo(() => {
        if (!analysisRange) return '';
        return `${analysisRange.start?.getTime()}-${analysisRange.end?.getTime()}`;
    }, [analysisRange?.start?.getTime(), analysisRange?.end?.getTime()]);

    // Deep compare employeeCalendars
    const calendarsJson = useMemo(() => {
        return employeeCalendars ? JSON.stringify(employeeCalendars) : '';
    }, [employeeCalendars]);

    useEffect(() => {
        // Si no hay datos, limpiamos
        if (!rawData || rawData.length === 0) {
            if (result.length > 0) {
                setResult([]);
                setStatus('idle');
                setError(null);
            }
            return;
        }

        // Increment token for this run
        processingTokenRef.current += 1;
        const CurrentToken = processingTokenRef.current;
        const processingStartTs = performance.now();

        setStatus('processing');
        setError(null);

        const isSmallVolume = (): boolean => {
            if (rawData.length < 2000) return true;
            if (analysisRange) {
                const startMs = analysisRange.start?.getTime?.() || 0;
                const endMs = analysisRange.end?.getTime?.() || 0;
                const dayMs = 24 * 60 * 60 * 1000;
                const rangeDays = Math.floor(Math.abs(endMs - startMs) / dayMs) + 1;
                return rangeDays <= 2;
            }
            return false;
        };

        // Función de respaldo sincrónico
        const runSynchronousFallback = () => {
            if (CurrentToken !== processingTokenRef.current) return;
            if (!isSmallVolume()) {
                if (CurrentToken === processingTokenRef.current) {
                    setStatus('error');
                    setError('El procesamiento ha tardado demasiado. Reduce el rango de fechas o activa modo rendimiento.');
                }
                return;
            }
            try {
                // Build map
                let calendarMap: Map<number, Map<string, number>> | undefined;
                if (employeeCalendars && typeof employeeCalendars === 'object') {
                    calendarMap = new Map();
                    Object.entries(employeeCalendars).forEach(([empId, dateObj]) => {
                        calendarMap!.set(Number(empId), new Map(Object.entries(dateObj)));
                    });
                }

                // Process
                const syncRes = processData(rawData, allUsers, undefined, analysisRange, holidays, calendarMap);
                trackPerfMetric('process_data_sync_fallback', performance.now() - processingStartTs, {
                    rows: rawData.length,
                    users: allUsers.length
                });

                // Only set if still relevant
                if (CurrentToken === processingTokenRef.current) {
                    setResult(syncRes);
                    setStatus('success');
                    setError(null);
                }
            } catch (err) {
                console.error("Worker/Fallback Error:", err);
                if (CurrentToken === processingTokenRef.current) {
                    setStatus('error');
                    setError('El procesamiento ha fallado. Reduce el rango de fechas o activa modo rendimiento.');
                }
            }
        };

        // Attempt Worker
        const runWorker = () => {
            try {
                if (!workerRef.current) {
                    workerRef.current = new Worker(new URL('../workers/processData.worker.ts', import.meta.url), { type: 'module' });
                }

                const worker = workerRef.current;
                let timeoutId: ReturnType<typeof setTimeout> | null = null;

                const cleanupWorker = (terminate: boolean) => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    if (worker) {
                        worker.onmessage = null;
                        worker.onerror = null;
                        if (terminate) {
                            worker.terminate();
                            workerRef.current = null;
                        }
                    }
                };

                const handleMessage = (e: MessageEvent<WorkerResponse>) => {
                    if (CurrentToken !== processingTokenRef.current) return;
                    cleanupWorker(false);

                    if (e.data?.success) {
                        setResult(e.data.data || []);
                        setStatus('success');
                        setError(null);
                        trackPerfMetric('process_data_worker', performance.now() - processingStartTs, {
                            rows: rawData.length,
                            users: allUsers.length
                        });
                    } else {
                        cleanupWorker(true);
                        console.error("Worker Error:", e.data?.error);
                        runSynchronousFallback();
                    }
                };

                const handleError = (err: Event) => {
                    if (CurrentToken !== processingTokenRef.current) return;
                    cleanupWorker(true);
                    console.error("Worker Error:", err);
                    runSynchronousFallback();
                };

                worker.onmessage = handleMessage;
                worker.onerror = handleError;

                timeoutId = setTimeout(() => {
                    if (CurrentToken !== processingTokenRef.current) return;
                    console.warn("Worker timeout, falling back to main thread.");
                    cleanupWorker(true);
                    runSynchronousFallback();
                }, WORKER_TIMEOUT_MS);

                worker.postMessage({
                    rawData,
                    allUsers,
                    employeeId: undefined,
                    analysisRange,
                    holidays: holidaysArray,
                    employeeCalendars
                });
            } catch (e) {
                console.error("Worker init error:", e);
                runSynchronousFallback();
            }
        };


        // Safety: Prevent Infinite Loops
        const now = Date.now();
        const timeSinceLastRun = now - (lastRunTimeRef.current || 0);
        lastRunTimeRef.current = now;

        if (timeSinceLastRun < 1000) {
            runSafeCounterRef.current += 1;
        } else {
            runSafeCounterRef.current = 1;
        }

        if (runSafeCounterRef.current > 5) {
            console.error("🚨 [useProcessDataWorker] Infinite Loop Detected! Stopping worker execution temporarily.");
            setStatus('error');
            setError('El procesamiento ha fallado. Reduce el rango de fechas o activa modo rendimiento.');
            return;
        }

        /* console.log(`⚙️ [useProcessDataWorker] Triggered by:`, {
             dataLen: rawData?.length,
             rangeKey: analysisRangeKey,
             holidaysKey: holidaysArray?.length,
             calendarsKey,
             usersKeyLen: usersKey?.length
        }); */

        // Small debounce to avoid clogging on rapid changes, but keeping it reactive
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(runWorker, 100);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };

    }, [rawData, allUsers, analysisRangeKey, holidaysArray, dataVersion, calendarsKey, usersKey, calendarsJson]);

    useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    return { result, status, error };
}
