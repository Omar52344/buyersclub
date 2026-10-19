import { API_URL } from './api';
import { loadSession } from './token-store';

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Conexión WebSocket autenticada con reconexión automática.
 * Devuelve una función para cerrarla.
 */
export function connectRealtime(
  onEvent: (event: RealtimeEvent) => void,
): () => void {
  let closed = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  async function connect() {
    const session = await loadSession();
    if (!session || closed) {
      return;
    }
    const url = `${API_URL.replace(/^http/, 'ws')}/v1/realtime?token=${encodeURIComponent(
      session.accessToken,
    )}`;

    socket = new WebSocket(url);
    socket.onmessage = (message) => {
      try {
        const parsed = JSON.parse(String(message.data)) as RealtimeEvent;
        onEvent(parsed);
      } catch {
        // Ignora mensajes malformados.
      }
    };
    socket.onclose = () => {
      if (!closed) {
        retry = setTimeout(() => {
          void connect();
        }, 3000);
      }
    };
    socket.onerror = () => {
      socket?.close();
    };
  }

  void connect();

  return () => {
    closed = true;
    if (retry) {
      clearTimeout(retry);
    }
    socket?.close();
  };
}
