import { randomUUID } from 'crypto';

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

  constructor(
    private readonly transport: { send: (message: unknown) => void; on: (event: 'message' | 'disconnect', listener: (...args: any[]) => void) => unknown },
  ) {
    transport.on('message', (message: any) => this.receive(message));
    transport.on('disconnect', () => this.close(new Error('channel disconnected')));
  }

  /** Answers the peer's requests. `handler` receives `(type, payload)` and its result is the reply. */
  serve(handler: (type: string, payload: any) => Promise<unknown>): void {
    this.handler = handler;
  }

  /** Sends a request and waits for its reply; rejects on timeout (`timeoutMs` > 0) or channel close. */
  request<T = unknown>(type: string, payload: unknown, timeoutMs = 0): Promise<T> {
    if (this.closed) return Promise.reject(new Error('channel closed'));
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = timeoutMs > 0
        ? setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`${type} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
        : null;
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
      this.answer(message);
    }
  }

  private async answer(message: { id: string; type: string; payload: unknown }): Promise<void> {
    if (!this.handler) {
      this.transport.send({ $fc: 'res', id: message.id, error: { message: `no handler for ${message.type}` } });
      return;
    }
    try {
      const result = await this.handler(message.type, message.payload);
      this.transport.send({ $fc: 'res', id: message.id, result });
    } catch (error: any) {
      this.transport.send({ $fc: 'res', id: message.id, error: PluginChannel.describe(error) });
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
