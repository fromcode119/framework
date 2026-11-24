import net from 'net';
import { NetworkAddressUtils } from '@fromcode119/core';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';
import { EdgeUpstreams } from '@cli/services/edge/edge-upstreams';
import { EdgeFirstBytes } from '@cli/services/edge/edge-first-bytes';
import { EdgeRefusals } from '@cli/services/edge/edge-refusals';
import { EdgeOriginConfig } from '@cli/services/edge/config/edge-origin-config';
import { EdgeTcpOrigin } from '@cli/services/edge/origins/edge-tcp-origin';
import { EdgeStaticRules } from '@cli/services/edge/rules/edge-static-rules';
import type { IEdgeOrigin } from '@cli/services/edge/interfaces/edge-origin.interface';
import type { IEdgeRuleSource } from '@cli/services/edge/interfaces/edge-rule-source.interface';

/**
 * An edge: holds public ports and passes every connection, still encrypted, to the server for its host.
 * It terminates nothing — the servers hold the certificates — and decides nothing in code: listeners,
 * servers, hosts and where its rules come from are its configuration (`EdgeConfig`).
 *
 * For each connection, in order:
 * 1. an address the rules refuse is closed at once, before a byte is read (`IEdgeRuleSource`);
 * 2. its first bytes give the host — SNI on TLS, `Host` on HTTP — and, from a relay the listener names
 *    in `acceptProxyFrom` only, the real visitor, who is checked against the rules again;
 * 3. the server for that host (an exact name, then `*.name`, then `*`) gets the connection, with a PROXY v2
 *    header naming the visitor when it asked for one, and the bytes already read, unchanged.
 *
 * Listeners bind with `reusePort`, so a new edge process takes the ports while the old one finishes the
 * connections it has: an edge is replaced with no refused connection.
 *
 * `legacy` is what the platform's own edge was before it had a configuration: one server for everything,
 * the header always, and a relay's header passed on for the gateway to read.
 */
export class PlatformEdge {
  static readonly STOP_GRACE_MS = 10_000;

  private readonly servers: net.Server[] = [];
  private readonly open = new Set<net.Socket>();
  private readonly refusals: EdgeRefusals;

  constructor(
    private readonly listeners: ReadonlyArray<{ port: number; protocol: string; acceptProxyFrom: readonly string[]; legacy?: boolean }>,
    private readonly origins: readonly IEdgeOrigin[],
    private readonly rules: IEdgeRuleSource = new EdgeStaticRules(),
    private readonly now: () => number = Date.now,
  ) {
    this.refusals = new EdgeRefusals(rules, now);
  }

  /** The platform's own edge from the environment, exactly as before configurations: 80 → the gateway's HTTP port, 443 → its TLS port. */
  static fromEnvironment(): PlatformEdge {
    const port = (name: string, fallback: number): number => {
      const parsed = Number.parseInt(String(process.env[name] || ''), 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    const host = String(process.env.EDGE_UPSTREAM_HOST || 'gateway').trim();
    const httpPort = port('EDGE_UPSTREAM_HTTP_PORT', 3000);
    return PlatformEdge.legacy(new EdgeUpstreams(host, httpPort), [
      { listen: port('EDGE_HTTP_PORT', 80), upstreamPort: httpPort },
      { listen: port('EDGE_HTTPS_PORT', 443), upstreamPort: port('GATEWAY_TLS_PORT', 3443) },
    ]);
  }

  /** One server for every connection, each public port to its own port on it. */
  static legacy(upstreams: EdgeUpstreams, routes: Array<{ listen: number; upstreamPort: number }>): PlatformEdge {
    const ports = Object.fromEntries(routes.map((route, index) => [`port${index}`, route.upstreamPort]));
    const origin = new EdgeTcpOrigin(new EdgeOriginConfig('gateway', ['*'], EdgeOriginConfig.TCP, '', ports, true, { type: 'http', path: '' }), upstreams);
    return new PlatformEdge(routes.map((route, index) => ({ port: route.listen, protocol: `port${index}`, acceptProxyFrom: [], legacy: true })), [origin]);
  }

  async start(): Promise<number[]> {
    for (const origin of this.origins) await origin.start();
    this.rules.start();
    this.refusals.start();
    const bound: number[] = [];
    for (const listener of this.listeners) {
      const server = await PlatformEdge.listen(listener.port, (client) => this.accept(client, listener));
      server.on('error', (error) => console.error(`[edge] listener :${listener.port}: ${error.message}`));
      this.servers.push(server);
      bound.push((server.address() as net.AddressInfo).port);
    }
    console.log(`[edge] holding ${bound.map((port, index) => `:${port} (${this.listeners[index].legacy ? 'tcp' : this.listeners[index].protocol})`).join(', ')}; servers: ${this.origins.map((origin) => `${origin.config.name}${origin.ready ? '' : ' (not ready)'}`).join(', ')}`);
    return bound;
  }

  /** Stops taking connections (a replacement on the same ports takes them) and gives the open ones `graceMs`. */
  async stop(graceMs: number): Promise<void> {
    for (const server of this.servers) server.close();
    this.rules.stop();
    await this.refusals.stop();
    for (const origin of this.origins) origin.stop();
    const deadline = Date.now() + graceMs;
    while (this.open.size > 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    for (const socket of this.open) socket.destroy();
  }

  get openConnections(): number {
    return this.open.size;
  }

  /** Ready: every server can take connections and the rules are current. */
  get ready(): boolean {
    return this.rules.fresh && this.origins.every((origin) => origin.ready);
  }

  private accept(client: net.Socket, listener: { port: number; protocol: string; acceptProxyFrom: readonly string[]; legacy?: boolean }): void {
    this.open.add(client);
    client.once('close', () => this.open.delete(client));
    client.on('error', () => client.destroy());
    const startedAt = this.now();
    const publicPort = client.localPort ?? listener.port;
    const direct = String(client.remoteAddress ?? '');
    // A relay this listener trusts is never refused for its own address: its visitors are judged one by one.
    if (!listener.legacy && !PlatformEdge.isRelay(direct, listener) && this.rules.current.refuses(direct, this.now())) return this.refuse(client, direct, publicPort);
    if (listener.legacy) return void this.pass(client, this.origins[0], listener.protocol, { address: direct, port: client.remotePort ?? 0 }, Buffer.alloc(0), publicPort, startedAt);
    void EdgeFirstBytes.read(client, listener.protocol, listener.acceptProxyFrom).then((first) => {
      if (!first) { client.destroy(); return; }
      if (first.proxied && this.rules.current.refuses(first.address, this.now())) { this.refuse(client, first.address, publicPort); return; }
      const origin = this.route(first.host);
      if (!origin) { client.destroy(); return; }
      void this.pass(client, origin, listener.protocol, first, first.bytes, publicPort, startedAt);
    });
  }

  private route(host: string): IEdgeOrigin | undefined {
    const exact = this.origins.find((origin) => origin.config.hosts.includes(host));
    return exact ?? this.origins.find((origin) => !origin.config.isDefault && origin.config.serves(host)) ?? this.origins.find((origin) => origin.config.isDefault);
  }

  private async pass(client: net.Socket, origin: IEdgeOrigin, protocol: string, visitor: { address: string; port: number }, bytes: Buffer, publicPort: number, startedAt: number): Promise<void> {
    const header = origin.config.proxyProtocol ? GatewayProxyProtocol.header(visitor.address, visitor.port, String(client.localAddress ?? ''), publicPort) : null;
    const upstream = await origin.connect(protocol, header, publicPort, startedAt);
    if (!upstream) { client.destroy(); return; }
    if (client.destroyed) { upstream.destroy(); return; }
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
    if (bytes.length) upstream.write(bytes);
    client.pipe(upstream);
    upstream.pipe(client);
    client.resume();
  }

  private refuse(client: net.Socket, address: string, port: number): void {
    this.refusals.refused(address, port);
    client.destroy();
  }

  /**
   * A listener with `reusePort`, so a replacement edge can bind the same port while this one drains. Where
   * the system has no such option (macOS) it listens without, and says that a replacement must wait for
   * the port. Any other failure — the port taken, no permission — fails the start: an edge that cannot
   * hold its port must not look as if it does.
   */
  private static listen(port: number, onConnection: (socket: net.Socket) => void): Promise<net.Server> {
    const attempt = (reusePort: boolean): Promise<net.Server> => new Promise((resolve, reject) => {
      const server = net.createServer({ pauseOnConnect: true }, onConnection);
      server.once('error', reject);
      server.listen({ port, ...(reusePort ? { reusePort: true } : {}) }, () => { server.removeListener('error', reject); resolve(server); });
    });
    return attempt(port !== 0).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOTSUP') throw new Error(`[edge] cannot listen on :${port}: ${error.message}`);
      console.warn(`[edge] :${port}: this system has no reusePort, so a replacement edge must wait for this one to close the port`);
      return attempt(false);
    });
  }

  private static isRelay(address: string, listener: { acceptProxyFrom: readonly string[] }): boolean {
    return NetworkAddressUtils.matchesAny(address, listener.acceptProxyFrom);
  }
}
