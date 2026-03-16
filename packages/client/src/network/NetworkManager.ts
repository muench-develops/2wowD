import {
  ClientMessage,
  ClientMessageType,
  ServerMessage,
  ServerMessageType,
  SERVER_PORT,
} from '@isoheim/shared';

type Listener = (data: any) => void;

export class NetworkManager {
  private static _instance: NetworkManager;
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Listener[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _latency = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  static get instance(): NetworkManager {
    if (!NetworkManager._instance) {
      NetworkManager._instance = new NetworkManager();
    }
    return NetworkManager._instance;
  }

  get latency(): number {
    return this._latency;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = `ws://${window.location.hostname || 'localhost'}:${SERVER_PORT}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[Network] Connected');
      this.connected = true;
      this.emit('connected', null);
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        this.handleMessage(msg);
      } catch (e) {
        console.error('[Network] Bad message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[Network] Disconnected');
      this.connected = false;
      this.stopPing();
      this.emit('disconnected', null);
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[Network] Error:', err);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(event: string, callback: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Listener): void {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  private emit(event: string, data: any): void {
    const list = this.listeners.get(event);
    if (list) {
      for (const cb of list) {
        cb(data);
      }
    }
  }

  private handleMessage(msg: ServerMessage): void {
    this.emit(msg.type, msg);

    if (msg.type === ServerMessageType.Pong) {
      this._latency = Date.now() - msg.timestamp;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send({ type: ClientMessageType.Ping, timestamp: Date.now() });
    }, 2000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[Network] Attempting reconnect...');
      this.connect();
    }, 3000);
  }

  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /** Cancel any pending reconnect without disconnecting. */
  cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
