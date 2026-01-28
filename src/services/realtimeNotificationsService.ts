
import { Role } from '../types';

export type RealtimeEventType = 'QUEUE_SYNC_RESULT' | 'GENERIC_INFO';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  userId?: number;
  roleTarget?: 'HR' | 'EMPLOYEE' | 'ALL';
  message: string;
  metadata?: any;
}

export type RealtimeEventHandler = (event: RealtimeEventPayload) => void;
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type ConnectionStatusHandler = (status: ConnectionStatus) => void;

class RealtimeService {
  private statusHandler: ConnectionStatusHandler | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';

  init(options: { userId: number; role: string; onEvent: RealtimeEventHandler }): () => void {
    // Placeholder sin conexión real a websocket externo
    return () => {};
  }

  onStatusChange(callback: ConnectionStatusHandler) {
      this.statusHandler = callback;
      callback(this.connectionStatus);
  }

  // Método interno para simular eventos locales si fuera necesario
  async sendEvent(event: RealtimeEventPayload): Promise<void> {
      // No-op
  }
}

export const RealtimeNotificationsService = new RealtimeService();
