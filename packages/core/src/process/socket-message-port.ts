import fs from 'fs';
import net from 'net';
import path from 'path';
import v8 from 'v8';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';

/**
 * Structured-clone messages over a Unix stream socket: a 4-byte big-endian length, then the
 * `v8.serialize` bytes — the same wire format Node's `serialization: 'advanced'` IPC uses, so a
 * `PluginChannel` behaves identically over either.
 *
 * Exists because a guest started by the privileged spawner is not our child: there is no IPC channel
 * to it. The app listens in a directory only that guest's user can traverse and accepts exactly one
 * connection ({@link listenOnce}); the guest connects to the path it was given on its command line.
 */
export class SocketMessagePort implements IMessagePort {
  /** A frame larger than this is a bug or an attack, not a message. */
  private static readonly MAX_FRAME_BYTES = 512 * 1024 * 1024;
  private static readonly HEADER_BYTES = 4;

  private buffer: Buffer = Buffer.alloc(0);
  private closed = false;
  private readonly messageListeners = new Set<(message: unknown) => void>();
  private readonly disconnectListeners = new Set<() => void>();

  constructor(private readonly socket: net.Socket) {
    socket.on('data', (chunk: Buffer) => this.receive(chunk));
    socket.on('close', () => this.disconnected());
    socket.on('error', () => this.disconnected());
  }

  /** The guest's side: connect to the host's socket. */
  static connect(socketPath: string, timeoutMs: number): Promise<SocketMessagePort> {
    return new Promise<SocketMessagePort>((resolve, reject) => {
      const socket = net.connect(socketPath);
      const timer = setTimeout(() => { socket.destroy(); reject(new Error(`connect to ${socketPath} timed out after ${timeoutMs} ms`)); }, timeoutMs);
      socket.once('connect', () => { clearTimeout(timer); resolve(new SocketMessagePort(socket)); });
      socket.once('error', (error) => { clearTimeout(timer); reject(error); });
    });
  }

  /**
   * The host's side: listen at `socketPath`, take the FIRST connection, and stop listening. One guest,
   * one connection — the listener is gone before anything else could try. The socket file's mode is set
   * after `listen` (it does not exist before); the directory's ownership is what keeps other users out.
   */
  static listenOnce(socketPath: string, mode: number, timeoutMs: number): Promise<SocketMessagePort> {
    fs.mkdirSync(path.dirname(socketPath), { recursive: true });
    if (fs.existsSync(socketPath)) fs.rmSync(socketPath, { force: true });
    return new Promise<SocketMessagePort>((resolve, reject) => {
      const server = net.createServer();
      const timer = setTimeout(() => { server.close(); reject(new Error(`no guest connected to ${socketPath} within ${timeoutMs} ms`)); }, timeoutMs);
      server.once('error', (error) => { clearTimeout(timer); reject(error); });
      server.once('connection', (socket) => {
        clearTimeout(timer);
        server.close();
        resolve(new SocketMessagePort(socket));
      });
      server.listen(socketPath, () => fs.chmodSync(socketPath, mode));
    });
  }

  send(message: unknown): void {
    if (this.closed) throw new Error('socket message port is closed');
    const body = v8.serialize(message);
    const header = Buffer.alloc(SocketMessagePort.HEADER_BYTES);
    header.writeUInt32BE(body.length, 0);
    this.socket.write(Buffer.concat([header, body]));
  }

  on(event: 'message' | 'disconnect', listener: (...args: any[]) => void): this {
    if (event === 'message') this.messageListeners.add(listener);
    else this.disconnectListeners.add(listener);
    return this;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
  }

  get isClosed(): boolean {
    return this.closed;
  }

  private receive(chunk: Buffer): void {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.buffer.length >= SocketMessagePort.HEADER_BYTES) {
      const length = this.buffer.readUInt32BE(0);
      if (length > SocketMessagePort.MAX_FRAME_BYTES) {
        this.close();
        return;
      }
      if (this.buffer.length < SocketMessagePort.HEADER_BYTES + length) return;
      const frame = this.buffer.subarray(SocketMessagePort.HEADER_BYTES, SocketMessagePort.HEADER_BYTES + length);
      this.buffer = this.buffer.subarray(SocketMessagePort.HEADER_BYTES + length);
      let message: unknown;
      try {
        message = v8.deserialize(frame);
      } catch {
        // A peer that sends bytes we cannot read is not a peer we keep talking to.
        this.close();
        return;
      }
      for (const listener of this.messageListeners) listener(message);
    }
  }

  private disconnected(): void {
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.disconnectListeners) listener();
  }
}
