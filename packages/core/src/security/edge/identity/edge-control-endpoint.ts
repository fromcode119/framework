import { isIP } from 'net';

/**
 * Where edges reach the platform's control channel (Settings → Security → Edges): the address an edge
 * dials and the port the gateway listens on for it. Both come from the operator; with either one empty
 * there is no channel, and the gateway opens no port for it.
 *
 * The address is also what the gateway's own certificate for that port is issued for, so an edge can
 * check it is talking to the platform and not to whoever answers on that address.
 */
export class EdgeControlEndpoint {
  private static readonly HOST_NAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

  constructor(readonly address: string, readonly port: number) {}

  /** The endpoint from the two settings, or null when either is empty or not a usable value. */
  static from(address: unknown, port: unknown): EdgeControlEndpoint | null {
    const host = String(address ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    const number = Number.parseInt(String(port ?? '').trim(), 10);
    if (!host || !Number.isInteger(number) || number < 1 || number > 65_535) return null;
    if (!isIP(host) && !EdgeControlEndpoint.HOST_NAME.test(host)) return null;
    return new EdgeControlEndpoint(host, number);
  }

  /** Whether the address is an IP (the certificate then names it as one) or a host name. */
  get isAddress(): boolean {
    return isIP(this.address) !== 0;
  }

  /** `host:port`, with an IPv6 address in brackets — what an edge is told to dial. */
  get dial(): string {
    return isIP(this.address) === 6 ? `[${this.address}]:${this.port}` : `${this.address}:${this.port}`;
  }

  toJSON(): Record<string, unknown> {
    return { address: this.address, port: this.port };
  }

  static fromJson(raw: unknown): EdgeControlEndpoint | null {
    const value = (raw ?? {}) as Record<string, unknown>;
    return EdgeControlEndpoint.from(value.address, value.port);
  }
}
