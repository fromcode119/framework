import http from 'http';
import net from 'net';
import { Duplex } from 'stream';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';

/**
 * One of the gateway's ports: accepts connections itself, reads the PROXY header (`GatewayProxyProtocol`),
 * and hands each connection to the HTTP or HTTPS server behind it — and knows how to stop gracefully.
 *
 * Stopping is what lets a deploy replace the gateway with no failed request. `edge` checks each gateway
 * every second and sends a new connection elsewhere when one refuses it; so the old gateway first stops
 * ACCEPTING (the new one takes every new connection), tells every response still to come to close its
 * connection, drops idle kept-alive connections, and exits once the requests in flight have finished.
 */
export class GatewayListener {
  private static readonly DRAIN_POLL_MS = 100;
  private static readonly LINGER_MS = 2_000;
  private readonly acceptor: net.Server;
  /** Every connection this port accepted and has not closed — what a graceful stop waits for. */
  private readonly open = new Set<net.Socket>();
  private stopping = false;
  // Declared BEFORE `listening`: field initialisers run in order, and one after it would overwrite the resolver.
  private markListening: () => void = () => undefined;

  constructor(
    private readonly server: http.Server,
    /** What a connection becomes once its header is read; the TLS listener wraps it in TLS first. */
    deliver: (socket: net.Socket) => void = (socket) => server.emit('connection', socket),
  ) {
    this.acceptor = net.createServer({ pauseOnConnect: true }, (socket) => {
      this.open.add(socket);
      socket.once('close', () => this.open.delete(socket));
      GatewayProxyProtocol.accept(socket, deliver);
    });
    this.acceptor.on('error', (error) => console.error('[platform-gateway] listener error:', error.message));
    // A response written after stopping must not invite the client to reuse this connection.
    server.on('request', (_req: http.IncomingMessage, res: http.ServerResponse) => { if (this.stopping) res.shouldKeepAlive = false; });
  }

  /**
   * `socket` as a plain stream that also yields what was read ahead of it. A TLS socket built on the
   * socket itself reads its native handle directly and skips those bytes — the ClientHello, when the
   * PROXY header arrived in the same packet — so the handshake would never complete.
   */
  static replaying(socket: net.Socket): Duplex {
    const stream = new Duplex({
      read() { socket.resume(); },
      write(chunk, encoding, callback) { socket.write(chunk, encoding, callback); },
      final(callback) { socket.end(); callback(); },
      destroy(error, callback) { socket.destroy(error ?? undefined); callback(error); },
    });
    socket.on('data', (chunk) => { if (!stream.push(chunk)) socket.pause(); });
    socket.on('end', () => stream.push(null));
    socket.on('error', (error) => stream.destroy(error));
    socket.on('close', () => stream.destroy());
    return stream;
  }

  /** Resolves once the port is bound. */
  readonly listening = new Promise<void>((resolve) => { this.markListening = resolve; });

  /** `host` only for tests, which run two gateways on one port at different loopback addresses. */
  listen(port: number, onListening: () => void, host?: string): void {
    const bound = (): void => { this.markListening(); onListening(); };
    if (host) this.acceptor.listen(port, host, bound);
    else this.acceptor.listen(port, bound);
  }

  /** The port actually bound (tests listen on 0). */
  get port(): number {
    return (this.acceptor.address() as net.AddressInfo | null)?.port ?? 0;
  }

  get openConnections(): number {
    return this.open.size;
  }

  /** Stops accepting, lets in-flight requests finish (up to `graceMs`), then resolves. */
  async stop(graceMs: number): Promise<void> {
    this.stopping = true;
    this.acceptor.close();
    const deadline = Date.now() + graceMs;
    // First keep serving connections already open, each response now saying `Connection: close`: a
    // client that reuses a kept-alive connection (Cloudflare does, to every origin) gets its answer and
    // opens the next connection to the replacement, instead of racing a close on an idle one.
    await new Promise((resolve) => setTimeout(resolve, Math.min(GatewayListener.LINGER_MS, graceMs)));
    while (this.open.size > 0 && Date.now() < deadline) {
      // Idle kept-alive connections go at once; a busy one closes after its response (`shouldKeepAlive`).
      this.server.closeIdleConnections();
      await new Promise((resolve) => setTimeout(resolve, GatewayListener.DRAIN_POLL_MS));
    }
    for (const socket of this.open) socket.destroy();
  }
}
