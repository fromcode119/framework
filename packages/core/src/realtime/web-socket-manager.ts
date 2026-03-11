import { WebSocket } from 'ws';
import type { WebSocketServer } from 'ws';
import { Logger } from '@fromcode119/sdk';
import { HookManager } from '../hooks/hook-manager';
import type { Message } from './web-socket-manager.interfaces';

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private logger = new Logger({ namespace: 'WebSocket' });
  private clients: Set<WebSocket> = new Set();
  private isClosing = false;

  constructor(private hooks: HookManager) {
    this.setupHooks();
  }

  public initialize(server: any) {
    const { WebSocketServer: WS_Server } = require('ws');
    this.wss = new WS_Server({ noServer: true });
    
    this.wss!.on('connection', (ws: WebSocket) => {
      if (!this.isClosing) this.logger.debug('Client connected');
      this.clients.add(ws);

      ws.on('message', (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (e) {
          this.logger.error('Failed to parse websocket message: ' + e);
        }
      });

      ws.on('close', () => {
        if (!this.isClosing) {
          this.logger.debug('Client disconnected');
        }
        this.clients.delete(ws);
      });

      // Send greeting
      ws.send(JSON.stringify({ type: 'system:ready', payload: { timestamp: Date.now() } }));
    });

    return this.wss;
  }

  public close() {
    this.isClosing = true;
    this.clients.forEach(client => {
      client.close();
    });
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
    }
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