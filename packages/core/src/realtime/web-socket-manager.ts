import { WebSocket } from 'ws';
import type { WebSocketServer } from 'ws';
import { Logger } from '@core/logging';
import { HookManager } from '@core/hooks/hook-manager';
import type { IMessage } from '@core/realtime/interfaces/message.interface';
import type { IRealtimeSocketBinding } from '@core/realtime/interfaces/realtime-socket-binding.interface';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { ApiWorkers } from '@core/cluster/api-workers';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';

/**
 * The live socket every `realtime:*` hook and every collection write is pushed through.
 *
 * A socket hears only the site it was admitted for. Every connection used to join ONE audience and
 * nobody was asked who they were, so an anonymous visitor on any site received every site's created,
 * updated and deleted rows as they happened. The api now admits a connection only with a session and
 * states its site (`IRealtimeSocketBinding`); an event goes to the sockets of the site whose request
 * produced it, and an event with no site goes nowhere — "no site" never means "every site".
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private logger = new Logger({ namespace: 'WebSocket' });
  private clients: Map<WebSocket, IRealtimeSocketBinding> = new Map();
  private isClosing = false;

  constructor(private hooks: HookManager) {
    this.setupHooks();
    // With several api processes an admin's socket lives in one of them, the write that produced an
    // event in any: each passes on what the others produced, to its own sockets of that site.
    ProcessSignals.on(ProcessSignal.REALTIME_BROADCAST, (payload: any, local: boolean) => {
      if (!local) this.deliver(String(payload?.data ?? ''), payload?.tenantId ?? null);
    });
  }

  public initialize(server: any) {
    const { WebSocketServer: WS_Server } = require('ws');
    this.wss = new WS_Server({ noServer: true });
    
    this.wss!.on('connection', (ws: WebSocket, _request: unknown, binding?: IRealtimeSocketBinding) => {
      // Admitted by the api's upgrade handler, which always states a binding. Without one, nobody did.
      if (!binding) {
        ws.close(1008, 'unauthorized');
        return;
      }
      if (!this.isClosing) this.logger.debug('Client connected');
      this.clients.set(ws, { tenantId: String(binding.tenantId ?? '').trim() || null });

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
    this.clients.forEach((_binding, client) => {
      client.close();
    });
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
    }
  }

  private handleMessage(ws: WebSocket, message: IMessage) {
    this.logger.debug(`Received message: ${message.type}`);
    
    // Plugins can hook into these messages
    this.hooks.emit(`socket:message:${message.type}`, { ws, payload: message.payload, plugin: message.plugin });
  }

  public broadcast(type: string, payload: any, plugin?: string) {
    const data = JSON.stringify({ type, payload, plugin });
    const sites = TenantMode.isEnabled();
    const tenantId = sites ? String(RequestContextUtils.getTenantId() ?? '').trim() || null : null;
    if (sites && !tenantId) return;
    this.deliver(data, tenantId);
    if (ApiWorkers.isMultiProcess()) ProcessSignals.announce(ProcessSignal.REALTIME_BROADCAST, { data, tenantId });
  }

  /** To this process's sockets of `tenantId`'s site (every socket on a single-site install). */
  private deliver(data: string, tenantId: string | null): void {
    if (!data) return;
    const sites = TenantMode.isEnabled();
    if (sites && !tenantId) return;
    this.clients.forEach((binding, client) => {
      if (sites && binding.tenantId !== tenantId) return;
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private setupHooks() {
    // Generic real-time bridge: ANY plugin can push a live event to connected websocket clients by emitting
    // a `realtime:<name>` hook (e.g. `realtime:commission_earned`). This is the reusable substrate for
    // real-time dashboards — a plugin never owns a socket; it just emits the hook and the framework fans it
    // out. (HookManager's `*` matches one non-colon segment, so use single-segment realtime event names.)
    this.hooks.on('realtime:*', (data: any, event: string) => {
      this.broadcast(event, data);
    });

    // Automatically broadcast certain system events
    this.hooks.on('system:hmr:reload', (data) => {
      this.broadcast('system:hmr:reload', data);
    });

    this.hooks.on('collection:*:afterCreate', (data: any, event: string) => {
      const slug = event.split(':')[1];
      this.broadcast(`collection:${slug}:created`, WebSocketManager.withoutPreviousRow(data));
    });

    this.hooks.on('collection:*:afterUpdate', (data: any, event: string) => {
      const slug = event.split(':')[1];
      this.broadcast(`collection:${slug}:updated`, WebSocketManager.withoutPreviousRow(data));
    });

    this.hooks.on('collection:*:afterDelete', (data: any, event: string) => {
      const slug = event.split(':')[1];
      this.broadcast(`collection:${slug}:deleted`, data);
    });
  }

  /** A record hook carries the row as it was before the write for plugin hooks; that copy is not broadcast. */
  private static withoutPreviousRow(data: any): any {
    if (data?._previousData === undefined) return data;
    const { _previousData: _previous, ...record } = data;
    return record;
  }
}
