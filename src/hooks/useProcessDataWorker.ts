
import { useState, useEffect, useRef, useMemo } from 'react';
import { RawDataRow, ProcessedDataRow, Shift, User } from '../types';
import { processData } from '../services/dataProcessor';

interface WorkerResponse {
    success: boolean;
    data?: ProcessedDataRow[];
    error?: string;
}

export function useProcessDataWorker(
    rawData: RawDataRow[],
    allUsers: User[],
    analysisRange?: { start: Date, end: Date },
    holidays?: Set<string>
) {
    const [result, setResult] = useState<ProcessedDataRow[]>([]);
    const [status, setStatus] = useState<'idle' | 'processing' | 'error' | 'success'>('idle');
    const workerRef = useRef<Worker | null>(null);
    const prevDataLengthRef = useRef<number>(0);
    const isProcessingRef = useRef<boolean>(false);

    // Memoize holidays array to prevent unnecessary re-renders
    const holidaysArray = useMemo(() => {
        return holidays ? Array.from(holidays) : [];
    }, [holidays]);

    // Memoize analysis range key to prevent unnecessary re-renders
    const analysisRangeKey = useMemo(() => {
        if (!analysisRange) return '';
        return `${analysisRange.start?.getTime()}-${analysisRange.end?.getTime()}`;
    }, [analysisRange]);

    useEffect(() => {
        // Si no hay datos, limpiamos y salimos (pero solo si había datos antes)
        if (!rawData || rawData.length === 0) {
            if (prevDataLengthRef.current > 0 || result.length > 0) {
                setResult([]);
                setStatus('idle');
                prevDataLengthRef.current = 0;
            }
            return;
        }

        // Evitar procesar si ya estamos procesando
        if (isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        prevDataLengthRef.current = rawData.length;
        setStatus('processing');

        // Función de respaldo en hilo principal
        const fallbackToMainThread = () => {
            try {
                const synchronousResult = processData(rawData, allUsers, undefined, analysisRange, holidays);
                setResult(synchronousResult);
                setStatus('success');
            } catch (err) {
                console.error("Error también en el hilo principal:", err);
                setStatus('error');
            } finally {
                isProcessingRef.current = false;
            }
        };

        try {
            // Inicializar Worker
            if (!workerRef.current) {
                workerRef.current = new Worker(new URL('../workers/processData.worker.ts', import.meta.url), { type: 'module' });
            }

            const worker = workerRef.current;

            worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
                isProcessingRef.current = false;
                if (e.data.success && e.data.data) {
                    setResult(e.data.data);
                    setStatus('success');
                } else {
                    console.warn("Worker reportó error, usando fallback:", e.data.error);
                    fallbackToMainThread();
                }
            };

            worker.onerror = (err) => {
                isProcessingRef.current = false;
                console.error("Error crítico en Worker, usando fallback:", err);
                fallbackToMainThread();
            };

            // Enviar datos al worker
            worker.postMessage({ rawData, allUsers, analysisRange, holidays: holidaysArray });

        } catch (e) {
            console.warn("No se pudo iniciar el Worker (posiblemente entorno no compatible), usando fallback.", e);
            fallbackToMainThread();
        }

        return () => {
            // Cleanup - marcar que no estamos procesando
            isProcessingRef.current = false;
        };

        // Usamos rawData.length y analysisRangeKey para evitar re-triggers innecesarios
    }, [rawData.length, allUsers.length, analysisRangeKey, holidaysArray.length]);

    return { result, status };
}
