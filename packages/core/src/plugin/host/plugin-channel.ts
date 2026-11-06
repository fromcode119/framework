import { randomUUID } from 'crypto';
import { MessagePortEvent } from '@core/process/enums/message-port-event.enum';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';

/**
 * Request/response over a Node IPC channel (`process.send` / `child.send`), in both directions.
 *
 * One class serves the host and the guest: each side `send`s requests and gets a promise back, and
 * `serve`s the requests the other side sends. Correlation is by id; a reply for an unknown id is
 * dropped (the requester already timed out or the peer restarted). Every outstanding request is
 * rejected when the channel closes, so a dead guest fails every waiting caller immediately instead of
 * leaving requests hanging for their full timeout.
 *
 * The transport is any `IMessagePort` — Node IPC with `serialization: 'advanced'`, or a framed Unix
 * socket carrying the same `v8.serialize` bytes (structured clone): Buffers, Dates, Maps survive;
 * functions do not — which is the point of the contract.
 */
export class PluginChannel {
  private readonly pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout | null }>();
  private handler: ((type: string, payload: any) => Promise<unknown>) | null = null;
  private closed = false;
  /** When the peer last asked something of this side — the sign that it is working, not stuck. */
  private lastPeerRequestAt = 0;

  constructor(
    private readonly transport: Pick<IMessagePort, 'send' | 'on'>,
  ) {
    transport.on(MessagePortEvent.MESSAGE, (message: any) => this.receive(message));
    transport.on(MessagePortEvent.DISCONNECT, () => this.close(new Error('channel disconnected')));
  }

  /** Answers the peer's requests. `handler` receives `(type, payload)` and its result is the reply. */
  serve(handler: (type: string, payload: any) => Promise<unknown>): void {
    this.handler = handler;
  }

  /**
   * Sends a request and waits for its reply; rejects on timeout (`timeoutMs` > 0) or channel close.
   *
   * `idle: true` makes `timeoutMs` a deadline on SILENCE instead of on the whole request: it fails only
   * after `timeoutMs` in which the peer asked this side nothing. A plugin's `onInit` after an update can
   * legitimately run for minutes — rewriting every row of a large catalogue — while
   * calling the host the whole time; a fixed deadline cut it off at 60 s, the update was abandoned, and the
   * process running the old code went on serving. A process that is really stuck goes quiet, and still fails.
   */
  request<T = unknown>(type: string, payload: unknown, timeoutMs = 0, options: { idle?: boolean } = {}): Promise<T> {
    if (this.closed) return Promise.reject(new Error('channel closed'));
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const startedAt = Date.now();
      const expire = (): void => {
        const entry = this.pending.get(id);
        if (!entry) return;
        const quietFor = Date.now() - Math.max(startedAt, this.lastPeerRequestAt);
        if (options.idle && quietFor < timeoutMs) {
          entry.timer = setTimeout(expire, timeoutMs - quietFor);
          return;
        }
        this.pending.delete(id);
        reject(new Error(options.idle ? `${type} timed out after ${timeoutMs}ms without any activity` : `${type} timed out after ${timeoutMs}ms`));
      };
      const timer = timeoutMs > 0 ? setTimeout(expire, timeoutMs) : null;
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      try {
        this.transport.send({ $fc: 'req', id, type, payload });
      } catch (error) {
        this.pending.delete(id);
        if (timer) clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Fire-and-forget notification: no reply expected. */
  notify(type: string, payload: unknown): void {
    if (this.closed) return;
    try {
      this.transport.send({ $fc: 'evt', type, payload });
    } catch {
      // A closed pipe: the close handler rejects everything pending; nothing else to do here.
    }
  }

  /** Notifications the peer sends with `notify`. */
  onNotify(listener: (type: string, payload: any) => void): void {
    this.notifyListener = listener;
  }

  private notifyListener: ((type: string, payload: any) => void) | null = null;

  close(reason: Error = new Error('channel closed')): void {
    if (this.closed) return;
    this.closed = true;
    for (const [id, entry] of this.pending) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(reason);
      this.pending.delete(id);
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Requests sent on this channel still awaiting their answer — what a retiring process must finish. */
  get pendingCount(): number {
    return this.pending.size;
  }

  private receive(message: any): void {
    if (!message || typeof message !== 'object' || typeof message.$fc !== 'string') return;
    if (message.$fc === 'res') {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (entry.timer) clearTimeout(entry.timer);
      if (message.error) entry.reject(PluginChannel.revive(message.error));
      else entry.resolve(message.result);
      return;
    }
    if (message.$fc === 'evt') {
      this.notifyListener?.(String(message.type), message.payload);
      return;
    }
    if (message.$fc === 'req') {
      this.lastPeerRequestAt = Date.now();
      this.answer(message);
    }
  }

  private async answer(message: { id: string; type: string; payload: unknown }): Promise<void> {
    if (!this.handler) {
      this.reply({ $fc: 'res', id: message.id, error: { message: `no handler for ${message.type}` } });
      return;
    }
    try {
      const result = await this.handler(message.type, message.payload);
      this.reply({ $fc: 'res', id: message.id, result });
    } catch (error: any) {
      this.reply({ $fc: 'res', id: message.id, error: PluginChannel.describe(error) });
    }
  }

  /**
   * Sends a reply unless the peer has gone. A request can still be running when its channel closes —
   * a plugin updated or restarted mid-request — and the reply then has nobody to reach. Sending on the
   * closed port threw, the catch above tried again on the same port, and the second throw escaped as an
   * unhandled rejection in the host. The requester is already failed by `close()`; there is nothing to do.
   */
  private reply(message: Record<string, unknown>): void {
    if (this.closed) return;
    try {
      this.transport.send(message);
    } catch {
      // The port closed before its disconnect event arrived: the peer is gone either way.
    }
  }

  /** Errors cross as data: message, code, name, and any `statusCode` a controller would map. */
  static describe(error: any): { message: string; name?: string; code?: string; statusCode?: number } {
    return {
      message: error instanceof Error ? error.message : String(error),
      name: error?.name,
      code: error?.code,
      statusCode: typeof error?.statusCode === 'number' ? error.statusCode : undefined,
    };
  }

  static revive(described: { message: string; name?: string; code?: string; statusCode?: number }): Error {
    const error = new Error(described?.message ?? 'unknown error') as Error & { code?: string; statusCode?: number };
    if (described?.name) error.name = described.name;
    if (described?.code) error.code = described.code;
    if (described?.statusCode) error.statusCode = described.statusCode;
    return error;
  }
}
