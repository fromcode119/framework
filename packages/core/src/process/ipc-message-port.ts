import type { IMessagePort } from '@core/process/interfaces/message-port.interface';

/**
 * Node's own IPC channel as an {@link IMessagePort}: `child.send`/`child.on` on the parent's side,
 * `process.send`/`process.on` on the child's. Structured clone comes from `serialization: 'advanced'`
 * at fork time, which every launcher here sets.
 */
export class IpcMessagePort implements IMessagePort {
  private closed = false;

  constructor(
    private readonly peer: {
      send?: (message: any, ...rest: any[]) => unknown;
      on: (event: string, listener: (...args: any[]) => void) => unknown;
      disconnect?: () => void;
      connected?: boolean;
    },
  ) {
    peer.on('disconnect', () => { this.closed = true; });
    peer.on('exit', () => { this.closed = true; });
  }

  send(message: unknown): void {
    if (this.closed) throw new Error('ipc message port is closed');
    this.peer.send?.(message);
  }

  on(event: 'message' | 'disconnect', listener: (...args: any[]) => void): this {
    this.peer.on(event, listener);
    return this;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.peer.connected) this.peer.disconnect?.();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
