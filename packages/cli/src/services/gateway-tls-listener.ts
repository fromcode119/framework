import http from 'http';
import http2 from 'http2';
import net from 'net';
import { Duplex } from 'stream';
import tls, { SecureContext } from 'tls';
import { CertificateBundle } from '@fromcode119/core';
import { CertificateBundleClient } from '@cli/services/certificate-bundle-client';
import { GatewayListener } from '@cli/services/gateway/gateway-listener';
import { GatewayTlsConnections } from '@cli/services/gateway/gateway-tls-connections';

/**
 * Terminates TLS for the platform, answering each handshake with the certificate stored for the name
 * the client asked for.
 *
 * THERE IS NO DEFAULT CERTIFICATE, deliberately. A name with nothing stored, and a client that sends
 * no name at all, are both refused at the handshake. The alternative — answering with some other
 * host's certificate, or a self-signed one — replaces a clean connection failure with a browser
 * security warning on a name the platform may not even serve, and teaches operators to click
 * through those warnings. A refused handshake is the honest answer to "I have nothing for that".
 *
 * OPT-IN. Without `GATEWAY_TLS_PORT` this never starts and the gateway behaves exactly as it did
 * before, which is what keeps a deployment whose edge already terminates TLS untouched.
 */
export class GatewayTlsListener {
  static readonly ENV_PORT = 'GATEWAY_TLS_PORT';

  /** Its open connections, which is what a graceful stop works through. */
  readonly connections = new GatewayTlsConnections();
  /** Accepts for this listener: reads the PROXY header from `edge`, and stops gracefully. */
  listener: GatewayListener | null = null;

  /**
   * One `SecureContext` per host, because building one parses and validates PEM on every handshake
   * otherwise. Cleared whenever the bundle changes rather than expired on a timer — a replaced
   * certificate must take effect on the next handshake, not a minute later.
   */
  private readonly contexts = new Map<string, SecureContext>();
  private cachedFrom: CertificateBundle | null = null;

  constructor(
    private readonly port: number,
    private readonly certificates: CertificateBundleClient,
    /** Trusted relays, as `GatewayListener` takes them. */
    private readonly relays: () => readonly string[] = () => [],
  ) {}

  /** The configured port, or null when TLS termination is off. 0 is valid — "any free port", for tests. */
  static readPort(): number | null {
    const raw = String(process.env[GatewayTlsListener.ENV_PORT] || '').trim();
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  get size(): number {
    return this.certificates.current?.size ?? 0;
  }

  start(handlers: {
    request: (req: http.IncomingMessage, res: http.ServerResponse) => void;
    upgrade: (req: http.IncomingMessage, socket: Duplex, head: Buffer) => void;
  }): void {
    this.listener = new GatewayListener(this.connections, (socket) => this.secure(socket, handlers), this.relays);
    this.listener.listen(this.port, () => {
      console.log(`[platform-gateway] terminating TLS on 0.0.0.0:${this.port} certificates=${this.size}`);
    });
  }

  /** Stops gracefully: no new connections, HTTP/2 sessions told to go away, in-flight requests finished. */
  async stop(graceMs: number): Promise<void> {
    await this.listener?.stop(graceMs);
  }

  /**
   * One accepted connection, terminated here: the certificate for the name asked for, or a refusal.
   *
   * HTTP/2 for every client that offers it (all current browsers), HTTP/1.1 for the rest and for
   * WebSockets — negotiated in the handshake (ALPN). Over HTTP/1.1 a browser opens at most six
   * connections per host, so a page's fonts, images and scripts queue behind each other; over HTTP/2
   * they share one connection.
   *
   * Node's secure HTTP/2 server does the handshake, created for THIS connection: it is the one place
   * the visitor from `edge`'s PROXY header is known, and the TLS socket Node makes is reachable only
   * from the server that made it. The socket is fed as a replaying stream (see
   * `GatewayListener.replaying`), so bytes read ahead with the header still reach the handshake.
   */
  private secure(socket: net.Socket, handlers: {
    request: (req: http.IncomingMessage, res: http.ServerResponse) => void;
    upgrade: (req: http.IncomingMessage, socket: Duplex, head: Buffer) => void;
  }): void {
    const visitor = { address: socket.remoteAddress, port: socket.remotePort };
    const server = http2.createSecureServer({
      allowHTTP1: true,
      ALPNProtocols: ['h2', 'http/1.1'],
      SNICallback: (servername, callback) => { void this.contextFor(servername, callback); },
    }, ((req: http.IncomingMessage, res: http.ServerResponse) => {
      this.connections.track(req, res);
      handlers.request(req, res);
    }) as unknown as (req: http2.Http2ServerRequest, res: http2.Http2ServerResponse) => void);

    server.on('secureConnection', (secure: tls.TLSSocket) => {
      Object.defineProperty(secure, 'remoteAddress', { value: visitor.address, configurable: true });
      Object.defineProperty(secure, 'remotePort', { value: visitor.port, configurable: true });
      if (secure.alpnProtocol !== 'h2') this.connections.addPlain(secure);
    });
    server.on('session', (session: http2.ServerHttp2Session) => {
      this.connections.addSession(session);
      session.on('error', (error: Error) => console.warn(`[platform-gateway] h2 session error: ${error.message}`));
    });
    server.on('upgrade', handlers.upgrade);
    server.on('tlsClientError', (error: Error, secure: tls.TLSSocket) => {
      // Every refused handshake lands here, including ordinary internet scanning. Logged at warn
      // without the peer's input echoed back.
      console.warn(`[platform-gateway] tls handshake refused: ${error.message}`);
      secure.destroy();
    });
    server.emit('connection', GatewayListener.replaying(socket));
  }

  /**
   * The context for one SNI name.
   *
   * Refusing is the normal path for anything the platform does not serve, so the error says only
   * that there is no certificate — never which hosts do have one.
   */
  private async contextFor(servername: string, callback: (error: Error | null, context?: SecureContext) => void): Promise<void> {
    try {
      const bundle = await this.certificates.resolve();
      if (!bundle) {
        callback(new Error('no certificates configured'));
        return;
      }
      if (bundle !== this.cachedFrom) {
        this.contexts.clear();
        this.cachedFrom = bundle;
      }

      const host = String(servername || '').trim().toLowerCase();
      const cached = this.contexts.get(host);
      if (cached) {
        callback(null, cached);
        return;
      }

      const entry = bundle.find(host);
      if (!entry) {
        callback(new Error('no certificate for the requested name'));
        return;
      }

      const context = tls.createSecureContext({ cert: entry.certificatePem, key: entry.privateKeyPem });
      this.contexts.set(host, context);
      callback(null, context);
    } catch (error: any) {
      // A malformed stored certificate must refuse ONE host's handshakes, never take the listener
      // down and with it every other site on the platform.
      console.warn(`[platform-gateway] could not build a TLS context: ${error?.message || error}`);
      callback(new Error('certificate unavailable'));
    }
  }
}
