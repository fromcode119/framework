import fs from 'fs';
import net from 'net';
import { randomUUID, timingSafeEqual } from 'crypto';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginChannelMessage } from '@core/plugin/host/enums/plugin-channel-message.enum';

/**
 * Every api connected to this plugin process — the one that started it, and any that attached since.
 *
 * A process used to have exactly one connection, to the api that started it, and nothing else could
 * reach it. For a new api to take over running plugins (a deploy that does not restart them), it must
 * be able to connect to a process it did not start. So the process also listens on `control.sock`,
 * next to its routes socket — in its own directory, which only the api's group can enter — and an api
 * that connects there must first say `hello` with the secret the process was booted with. Until it
 * has, nothing else it sends is served.
 *
 * The process outlives the api that started it when another holds it: that one becomes the primary
 * (`primaryLost`), and with none the process waits a while for a deploy's next api before exiting.
 *
 * Each attached api gets its own channel. A call back to an api goes on the channel of the invocation
 * that made it (see `PluginGuestRemote.channelFor`); an HTTP request an attached api forwards names its
 * connection in `x-fc-connection`, because the routes socket is shared.
 */
export class PluginGuestConnections {
  static readonly CONTROL_SOCKET = 'control.sock';
  static readonly HEADER_CONNECTION = 'x-fc-connection';

  private readonly attached = new Map<string, { channel: PluginChannel; socket: net.Socket }>();
  private server: net.Server | null = null;
  /** Set while no api holds this process: it exits when this fires, unless one attaches first. */
  private lingering: NodeJS.Timeout | null = null;

  constructor(
    /** The api this process serves by default — the one that started it, until that one is gone. */
    public primary: PluginChannel,
    private readonly serve: (channel: PluginChannel, type: string, payload: unknown) => Promise<unknown>,
    private readonly hello: () => Record<string, unknown>,
  ) {}

  /** The channel for a connection id; the process's first connection for none or an unknown one. */
  channel(connectionId: string | null | undefined): PluginChannel {
    return (connectionId && this.attached.get(connectionId)?.channel) || this.primary;
  }

  get attachedCount(): number {
    return this.attached.size;
  }

  async listen(socketPath: string, mode: number, secret: string, lingerMs = 0, exit: () => void = () => process.exit(0)): Promise<void> {
    fs.rmSync(socketPath, { force: true });
    const server = net.createServer((socket) => this.accept(socket, secret, lingerMs, exit));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(socketPath, () => { server.off('error', reject); resolve(); });
    });
    fs.chmodSync(socketPath, mode);
    this.server = server;
  }

  /**
   * The primary api is gone. Another attached api becomes the primary; with none, the process waits
   * `lingerMs` for one to attach — a deploy's next api — and exits if none does (at once for 0).
   */
  primaryLost(lingerMs: number, exit: () => void): void {
    const next = this.attached.values().next().value;
    if (next) { this.promote(next.channel); return; }
    if (lingerMs <= 0) { exit(); return; }
    this.lingering = setTimeout(exit, lingerMs);
  }

  private promote(channel: PluginChannel): void {
    if (this.lingering) clearTimeout(this.lingering);
    this.lingering = null;
    this.primary = channel;
    PluginGuestRemote.primary = channel;
  }

  close(): void {
    this.server?.close();
    this.server = null;
    for (const { channel, socket } of this.attached.values()) { channel.close(); socket.destroy(); }
    this.attached.clear();
  }

  private static sameSecret(offered: unknown, secret: string): boolean {
    const a = Buffer.from(String(offered ?? ''));
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private accept(socket: net.Socket, secret: string, lingerMs: number, exit: () => void): void {
    const channel = new PluginChannel(new SocketMessagePort(socket));
    let connectionId: string | null = null;
    socket.on('close', () => {
      if (connectionId) this.attached.delete(connectionId);
      // An attached api that had become the primary goes the same way the first one did.
      if (this.primary === channel) this.primaryLost(lingerMs, exit);
    });
    channel.serve(async (type, payload) => {
      if (type === String(PluginChannelMessage.HELLO.value)) {
        if (!PluginGuestConnections.sameSecret((payload as { secret?: unknown } | null)?.secret, secret)) {
          setImmediate(() => { channel.close(); socket.destroy(); });
          throw new Error('guest: attach refused — wrong secret');
        }
        connectionId = randomUUID();
        this.attached.set(connectionId, { channel, socket });
        if (this.lingering) this.promote(channel);
        return { connectionId, ...this.hello() };
      }
      if (!connectionId) throw new Error('guest: say hello first');
      return this.serve(channel, type, payload);
    });
  }
}
