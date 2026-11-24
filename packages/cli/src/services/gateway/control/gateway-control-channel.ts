import http from 'http';
import tls from 'tls';
import { EdgeControlPaths } from '@fromcode119/core';
import type { TenantRouteMap } from '@fromcode119/core';
import { GatewayControlApi } from '@cli/services/gateway/control/gateway-control-api';
import { GatewayControlIdentity } from '@cli/services/gateway/control/gateway-control-identity';
import { GatewayControlRequests } from '@cli/services/gateway/control/gateway-control-requests';
import { GatewayEdgeVerifier } from '@cli/services/gateway/control/gateway-edge-verifier';

/**
 * The port edges reach the platform on (Settings → Security → Edges → control address and port), apart
 * from the ports visitors use. Mutual TLS 1.3 only: the gateway proves it is the platform with a
 * certificate for the configured address, and an edge proves which edge it is with its own.
 *
 * Opened only while both settings are set, moved when the port changes, closed when they are cleared —
 * checked against the routing map every {@link CHECK_MS}. One port, two uses told apart by ALPN: control
 * requests, and the tunnel that carries visitors (`onTunnel`, step 5 of the edge plan).
 */
export class GatewayControlChannel {
  private static readonly CHECK_MS = 5_000;
  private server: tls.Server | null = null;
  private port = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly http: http.Server;
  readonly verifier: GatewayEdgeVerifier;
  private readonly identity: GatewayControlIdentity;

  constructor(
    private readonly map: () => TenantRouteMap | null,
    /** A verified edge's tunnel connection; the handler owns the socket from here. */
    private readonly onTunnel: (socket: tls.TLSSocket, edge: { id: string; name: string }) => void = (socket) => socket.destroy(),
    api: GatewayControlApi = new GatewayControlApi(),
  ) {
    this.verifier = new GatewayEdgeVerifier(api);
    this.identity = new GatewayControlIdentity(api, () => this.applyIdentity());
    const requests = new GatewayControlRequests(api, this.verifier, map, () => this.identity.material?.ca ?? '');
    this.http = http.createServer((req, res) => {
      res.on('error', () => undefined);
      void requests.handle(req, res).catch((error) => {
        console.warn('[platform-gateway] control request failed:', error?.message || error);
        if (!res.headersSent) { res.writeHead(500); res.end(); }
      });
    });
    this.http.headersTimeout = 10_000;
    this.http.requestTimeout = EdgeControlPaths.RULES_WAIT_MS + 10_000;
  }

  /** The port it listens on, or 0 when closed. */
  get listeningPort(): number {
    const address = this.server?.address();
    return address && typeof address === 'object' ? address.port : 0;
  }

  start(): void {
    void this.check();
    this.timer = setInterval(() => { void this.check(); }, GatewayControlChannel.CHECK_MS);
    this.timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.identity.stop();
    await this.close();
  }

  /** Opens, moves or closes the port to match the settings the routing map carries. */
  async check(): Promise<void> {
    const control = this.map()?.control ?? null;
    if (!control) { await this.close(); return; }
    await this.identity.ensure(control.address);
    if (!this.identity.material) return;
    if (this.server && this.port === control.port) return;
    await this.close();
    await this.open(control.port);
  }

  private open(port: number): Promise<void> {
    const material = this.identity.material!;
    const server = tls.createServer({
      ...material,
      minVersion: 'TLSv1.3',
      // A certificate is asked of every edge and checked against the platform's authority; one without
      // a certificate gets as far as `enroll` and no further.
      requestCert: true,
      rejectUnauthorized: false,
      ALPNProtocols: [EdgeControlPaths.TUNNEL, EdgeControlPaths.CONTROL],
      handshakeTimeout: 10_000,
    });
    server.on('secureConnection', (socket) => { void this.accept(socket); });
    server.on('tlsClientError', () => undefined);
    return new Promise((resolve) => {
      server.once('error', (error) => { console.error(`[platform-gateway] control: cannot listen on ${port}: ${error.message}`); resolve(); });
      server.listen(port, () => {
        this.server = server;
        this.port = port;
        console.log(`[platform-gateway] control channel listening on ${this.listeningPort} (mutual TLS)`);
        resolve();
      });
    });
  }

  private async accept(socket: tls.TLSSocket): Promise<void> {
    socket.on('error', () => undefined);
    if (socket.alpnProtocol !== EdgeControlPaths.TUNNEL) { this.http.emit('connection', socket); return; }
    const edge = await this.verifier.edgeOf(socket);
    if (!edge) { socket.destroy(); return; }
    this.onTunnel(socket, edge);
  }

  /** A renewed certificate applies to new connections at once; open ones keep theirs. */
  private applyIdentity(): void {
    if (this.server && this.identity.material) this.server.setSecureContext({ ...this.identity.material });
  }

  private close(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.port = 0;
    if (!server) return Promise.resolve();
    return new Promise((resolve) => server.close(() => resolve()));
  }
}
