/**
 * One end of a message pipe between two processes — Node IPC (a forked child) or a framed Unix
 * socket (a process the privileged spawner started, which is no child of ours). `PluginChannel` and
 * every other request/reply layer sits on top of this and never knows which one it has.
 */
export interface IMessagePort {
  send(message: unknown): void;
  on(event: 'message' | 'disconnect', listener: (...args: any[]) => void): unknown;
  close(): void;
  readonly isClosed: boolean;
}
