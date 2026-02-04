import { WebSocket, WebSocketServer } from 'ws';
import { Logger } from '../logging/logger';
import { HookManager } from '../hooks/manager';

export interface Message {
  type: string;
  payload: any;
  plugin?: string;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private logger = new Logger({ namespace: 'WebSocket' });
  private clients: Set<WebSocket> = new Set();

  constructor(private hooks: HookManager) {
    this.setupHooks();
  }

  public initialize(server: any) {
    this.wss = new WebSocketServer({ noServer: true });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.logger.debug('New client connected');
      this.clients.add(ws);

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(ws, message);
        } catch (e) {
          this.logger.error('Failed to parse websocket message: ' + e);
        }
      });

      ws.on('close', () => {
        this.logger.debug('Client disconnected');
        this.clients.delete(ws);
      });

      // Send greeting
      ws.send(JSON.stringify({ type: 'system:ready', payload: { timestamp: Date.now() } }));
    });

    return this.wss;
  }

  private handleMessage(ws: WebSocket, message: Message) {
    this.logger.debug(`Received message: ${message.type}`);
    
    // Plugins can hook into these messages
    this.hooks.emit(`socket:message:${message.type}`, { ws, payload: message.payload, plugin: message.plugin });
  }

  public broadcast(type: string, payload: any, plugin?: string) {
    const data = JSON.stringify({ type, payload, plugin });
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private setupHooks() {
    // Automatically broadcast certain system events
    this.hooks.on('system:hmr:reload', (data) => {
      this.broadcast('system:hmr:reload', data);
    });

    this.hooks.on('collection:*:afterCreate', (data: any, event: string) => {
      const slug = event.split(':')[1];
      this.broadcast(`collection:${slug}:created`, data);
    });

    this.hooks.on('collection:*:afterUpdate', (data: any, event: string) => {
      const slug = event.split(':')[1];
      this.broadcast(`collection:${slug}:updated`, data);
    });

    this.hooks.on('collection:*:afterDelete', (data: any, event: string) => {
      const slug = event.split(':')[1];
      this.broadcast(`collection:${slug}:deleted`, data);
    });
  }
}
