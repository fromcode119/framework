import net from 'net';
import { EdgeUpstreams } from '@cli/services/edge/edge-upstreams';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';

/**
 * The platform's `edge`: holds the public ports and passes every connection, untouched, to a gateway.
 *
 * It routes nothing — which host goes where is the gateway's, from the admin's host aliases — and
 * terminates nothing: the gateway holds the certificates, so this is plain TCP. What it adds is what
 * lets the gateway be REPLACED with no gap: during a deploy two gateways run side by side, each new
 * connection goes to one that answers (`EdgeUpstreams`), and the old one drains and exits. A connection
 * a stopping gateway refuses is tried on another before the visitor would notice.
 *
 * Each connection starts with a PROXY protocol v2 header naming the visitor (`GatewayProxyProtocol`),
 * or the gateway would see every visitor as this process.
 *
 * Another relay may stand in front of this one (a second edge on its own address, so the sites stay
 * reachable where a shared CDN address is blocked). That relay names the visitor in its own PROXY
 * header, and this edge passes that visitor on — but ONLY for connections from the addresses listed in
 * `EDGE_TRUSTED_RELAYS`. From anywhere else a header is not read: anyone could write one and pose as
 * any visitor.
 *
 * Not replaced by deploys: a rolling deploy only starts it when missing, so the ports stay held.
 */
export class PlatformEdge {
  static readonly STOP_GRACE_MS = 10_000;
  private static readonly ATTEMPTS = 3;
  private static readonly CONNECT_TIMEOUT_MS = 2_000;

  private readonly servers: net.Server[] = [];
  private readonly open = new Set<net.Socket>();

  constructor(
    private readonly upstreams: EdgeUpstreams,
    /** Public port → the gateway's port it forwards to. */
    private readonly routes: Array<{ listen: number; upstreamPort: number }>,
    /** Relays in front of this edge whose PROXY header is believed (`EDGE_TRUSTED_RELAYS`). */
    private readonly trustedRelays: ReadonlySet<string> = new Set(),
  ) {}

  /** From the environment: 80 → the gateway's HTTP port, 443 → its TLS port. */
  static fromEnvironment(): PlatformEdge {
    const port = (name: string, fallback: number): number => {
      const parsed = Number.parseInt(String(process.env[name] || ''), 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    const host = String(process.env.EDGE_UPSTREAM_HOST || 'gateway').trim();
    const httpPort = port('EDGE_UPSTREAM_HTTP_PORT', 3000);
    const relays = String(process.env.EDGE_TRUSTED_RELAYS || '').split(',').map((entry) => PlatformEdge.address(entry.trim())).filter(Boolean);
    return new PlatformEdge(new EdgeUpstreams(host, httpPort), [
      { listen: port('EDGE_HTTP_PORT', 80), upstreamPort: httpPort },
      { listen: port('EDGE_HTTPS_PORT', 443), upstreamPort: port('GATEWAY_TLS_PORT', 3443) },
    ], new Set(relays));
  }

  /** An address as compared here: IPv4-mapped IPv6 (Node's dual-stack form) as plain IPv4. */
  private static address(value: string): string {
    return value.startsWith('::ffff:') && net.isIPv4(value.slice(7)) ? value.slice(7) : value;
  }

  async start(): Promise<number[]> {
    this.upstreams.start();
    await this.upstreams.check();
    const bound: number[] = [];
    for (const route of this.routes) {
      const server = net.createServer({ pauseOnConnect: true }, (client) => this.accept(client, route.upstreamPort));
      server.on('error', (error) => console.error(`[edge] listener :${route.listen}: ${error.message}`));
      await new Promise<void>((resolve) => server.listen(route.listen, resolve));
      this.servers.push(server);
      bound.push((server.address() as net.AddressInfo).port);
    }
    console.log(`[edge] holding ${bound.map((p, i) => `:${p} → gateway:${this.routes[i].upstreamPort}`).join(', ')}; gateways answering: ${this.upstreams.healthyCount}`);
    return bound;
  }

  /** Stops taking connections and gives the open ones `graceMs` to finish. */
  async stop(graceMs: number): Promise<void> {
    for (const server of this.servers) server.close();
    this.upstreams.stop();
    const deadline = Date.now() + graceMs;
    while (this.open.size > 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    for (const socket of this.open) socket.destroy();
  }

  get openConnections(): number {
    return this.open.size;
  }

  private accept(client: net.Socket, upstreamPort: number): void {
    this.open.add(client);
    client.once('close', () => this.open.delete(client));
    client.on('error', () => client.destroy());
    if (this.trustedRelays.has(PlatformEdge.address(String(client.remoteAddress ?? '')))) {
      GatewayProxyProtocol.accept(client, (socket) => this.forward(socket, upstreamPort), { resume: false });
      return;
    }
    this.forward(client, upstreamPort);
  }

  private forward(client: net.Socket, upstreamPort: number): void {
    const header = GatewayProxyProtocol.header(String(client.remoteAddress ?? ''), client.remotePort ?? 0, String(client.localAddress ?? ''), client.localPort ?? 0);
    void this.connect(upstreamPort, header, new Set()).then((upstream) => {
      if (!upstream) { client.destroy(); return; }
      if (client.destroyed) { upstream.socket.destroy(); return; }
      this.upstreams.count(upstream.address, 1);
      upstream.socket.once('close', () => this.upstreams.count(upstream.address, -1));
      upstream.socket.on('error', () => client.destroy());
      client.on('close', () => upstream.socket.destroy());
      upstream.socket.on('close', () => client.destroy());
      client.pipe(upstream.socket);
      upstream.socket.pipe(client);
      client.resume();
    });
  }

  /** A connection to a gateway that accepts it, with the header already sent — or null when none does. */
  private async connect(port: number, header: Buffer, tried: Set<string>): Promise<{ address: string; socket: net.Socket } | null> {
    for (let attempt = 0; attempt < PlatformEdge.ATTEMPTS; attempt += 1) {
      const address = this.upstreams.candidates(tried)[0];
      if (!address) {
        // Nothing healthy (a gateway starting, or all being replaced): look again once before giving up.
        await this.upstreams.check();
        if (!this.upstreams.candidates(tried).length) return null;
        continue;
      }
      tried.add(address);
      const socket = await PlatformEdge.open(address, port);
      if (socket) {
        socket.write(header);
        return { address, socket };
      }
      this.upstreams.refused(address);
    }
    return null;
  }

  private static open(address: string, port: number): Promise<net.Socket | null> {
    return new Promise((resolve) => {
      const socket = net.connect({ host: address, port });
      const timer = setTimeout(() => { socket.destroy(); resolve(null); }, PlatformEdge.CONNECT_TIMEOUT_MS);
      socket.once('connect', () => { clearTimeout(timer); resolve(socket); });
      socket.once('error', () => { clearTimeout(timer); resolve(null); });
    });
  }
}
