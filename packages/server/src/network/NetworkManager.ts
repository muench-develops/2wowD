import { WebSocketServer, WebSocket } from 'ws';
import {
  ServerMessage,
  ClientMessage,
  SERVER_PORT,
  MAX_PLAYERS,
  generateId,
} from '@isoheim/shared';

export class NetworkManager {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocket> = new Map();
  private socketToId: Map<WebSocket, string> = new Map();

  /** Callbacks for connection events */
  onConnect: ((sessionId: string) => void) | null = null;
  onDisconnect: ((sessionId: string) => void) | null = null;
  onMessage: ((sessionId: string, message: ClientMessage) => void) | null = null;

  start(): void {
    this.wss = new WebSocketServer({ port: SERVER_PORT });

    this.wss.on('listening', () => {
      console.log(`[Network] WebSocket server listening on port ${SERVER_PORT}`);
    });

    this.wss.on('connection', (ws: WebSocket) => {
      if (this.connections.size >= MAX_PLAYERS) {
        ws.close(1013, 'Server full');
        return;
      }

      const sessionId = generateId();
      this.connections.set(sessionId, ws);
      this.socketToId.set(ws, sessionId);

      console.log(`[Network] Client connected: ${sessionId}`);
      this.onConnect?.(sessionId);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          this.onMessage?.(sessionId, message);
        } catch (err) {
          console.error(`[Network] Invalid message from ${sessionId}:`, err);
        }
      });

      ws.on('close', () => {
        console.log(`[Network] Client disconnected: ${sessionId}`);
        this.connections.delete(sessionId);
        this.socketToId.delete(ws);
        this.onDisconnect?.(sessionId);
      });

      ws.on('error', (err) => {
        console.error(`[Network] Error from ${sessionId}:`, err);
      });
    });

    this.wss.on('error', (err) => {
      console.error('[Network] Server error:', err);
    });
  }

  sendToPlayer(playerId: string, message: ServerMessage): void {
    const ws = this.connections.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastToAll(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  broadcastToPlayers(playerIds: string[], message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const id of playerIds) {
      const ws = this.connections.get(id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.connections.clear();
    this.socketToId.clear();
  }
}
