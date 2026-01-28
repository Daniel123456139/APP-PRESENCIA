
import { getApiBaseUrl } from '../config/apiConfig';

export type ServerStatus = 'online' | 'offline' | 'connecting';

type StatusListener = (status: ServerStatus, latency: number | null) => void;

const BASE_INTERVAL_MS = 15000; // 15 segundos en estado normal
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const FETCH_TIMEOUT_MS = 5000; // Timeout estricto para el ping

class ServerConnectionMonitorService {
    private status: ServerStatus = 'connecting';
    private latency: number | null = null;
    private listeners: StatusListener[] = [];
    private timerId: any = null;
    private abortController: AbortController | null = null;
    
    // Control de Backoff
    private retryCount = 0;
    private isRunning = false;

    constructor() {
        // Escuchar cambios en la configuración de la API para reiniciar chequeo inmediatamente
        if (typeof window !== 'undefined') {
            window.addEventListener('apiBaseUrlChanged', () => {
                console.log("API URL Changed detected by Monitor. Restarting check...");
                this.forceCheck();
            });
        }
    }

    /**
     * Inicia el ciclo de monitorización.
     */
    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.checkConnection();
    }

    /**
     * Detiene la monitorización.
     */
    public stop() {
        this.isRunning = false;
        if (this.timerId) clearTimeout(this.timerId);
        if (this.abortController) this.abortController.abort();
    }

    /**
     * Fuerza una comprobación inmediata (útil tras reconexión de red detectada por navegador).
     */
    public forceCheck() {
        this.stop();
        this.retryCount = 0;
        this.status = 'connecting';
        this.notify();
        this.start();
    }

    /**
     * Suscribirse a cambios de estado.
     */
    public subscribe(callback: StatusListener): () => void {
        this.listeners.push(callback);
        // Emitir estado actual inmediatamente
        callback(this.status, this.latency);
        
        // Si es el primer suscriptor, arrancamos el monitor
        if (this.listeners.length === 1) {
            this.start();
        }

        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
            // Si no quedan suscriptores, pausamos para ahorrar recursos
            if (this.listeners.length === 0) {
                this.stop();
            }
        };
    }

    public getStatus() {
        return this.status;
    }

    public getLatency() {
        return this.latency;
    }

    private notify() {
        this.listeners.forEach(listener => listener(this.status, this.latency));
    }

    private async checkConnection() {
        if (!this.isRunning) return;

        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();

        // Timeout de seguridad para el ping
        const timeoutId = setTimeout(() => {
            if (this.abortController) this.abortController.abort();
        }, FETCH_TIMEOUT_MS);

        const startTime = Date.now();
        const baseUrl = getApiBaseUrl();
        const checkEndpoint = `${baseUrl}/docs`; // Asumiendo endpoint docs o root

        try {
            // Intentamos un fetch simple GET
            await fetch(checkEndpoint, {
                method: 'GET',
                mode: 'no-cors', // Importante para evitar bloqueos CORS en el ping
                signal: this.abortController.signal,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);

            // Si llegamos aquí, hay conexión TCP/IP
            const endTime = Date.now();
            this.latency = endTime - startTime;
            
            if (this.status !== 'online') {
                this.status = 'online';
                this.retryCount = 0; // Reset backoff
                this.notify();
            } else {
                // Solo notificamos latencia si ya estábamos online
                this.notify();
            }

            // Programar siguiente check normal
            this.scheduleNext(BASE_INTERVAL_MS);

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                // Timeout del fetch propio
                console.warn("Connection Monitor: Ping timeout");
            }

            const wasOnline = this.status === 'online';
            this.status = 'offline';
            this.latency = null;
            
            if (wasOnline) {
                this.notify();
            }

            // Calcular backoff exponencial
            const delay = Math.min(
                MIN_BACKOFF_MS * Math.pow(2, this.retryCount),
                MAX_BACKOFF_MS
            );
            
            this.retryCount++;
            this.scheduleNext(delay);
        }
    }

    private scheduleNext(delayMs: number) {
        if (this.timerId) clearTimeout(this.timerId);
        this.timerId = setTimeout(() => {
            this.checkConnection();
        }, delayMs);
    }
}

export const ServerConnectionMonitor = new ServerConnectionMonitorService();
