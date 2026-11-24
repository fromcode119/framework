/**
 * One server an edge passes connections to.
 *
 * - `tcp` — the connection as it is, to `address` on the port for the listener's protocol, with a PROXY v2
 *   header naming the visitor when `proxyProtocol` is on. For any server: nginx, HAProxy, another edge.
 *   That server must then accept connections from this edge only — the header is believed by source.
 * - `fromcode` — through the mutual-TLS tunnel to a Fromcode platform's control address. The platform
 *   knows which edge it is from the certificate; nothing between them can read or alter the traffic.
 */
export class EdgeOriginConfig {
  static readonly TCP = 'tcp';
  static readonly FROMCODE = 'fromcode';

  constructor(
    readonly name: string,
    /** `example.com`, `*.example.com`, or `*` for every host no other origin names. */
    readonly hosts: readonly string[],
    readonly transport: string,
    /** tcp: a host name (every address it resolves to is used) or an IP. */
    readonly address: string,
    /** tcp: the origin's port for each listener protocol (`http`, `tls`). */
    readonly ports: Readonly<Record<string, number>>,
    readonly proxyProtocol: boolean,
    /** tcp: `http` asks `healthPath` on the `http` port and wants 200; `tcp` only connects; `none` never checks. */
    readonly health: { type: string; path: string },
  ) {}

  /** Whether this origin serves `host` (lower case, no port). */
  serves(host: string): boolean {
    return this.hosts.some((pattern) => pattern === host || (pattern.startsWith('*.') && host.endsWith(pattern.slice(1)) && host.length > pattern.length - 1));
  }

  get isDefault(): boolean {
    return this.hosts.includes('*');
  }
}
