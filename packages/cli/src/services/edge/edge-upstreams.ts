import dns from 'dns';
import net from 'net';

/**
 * The gateways `edge` may send a connection to: every address the gateway's name resolves to (Docker's
 * DNS lists one per running container), each checked by a TCP connect about every second.
 *
 * A gateway being replaced stops accepting first (`GatewayListener.stop`), so its check fails within
 * a second and new connections go to the one replacing it; a connection that still reaches it in that
 * second is refused and retried elsewhere (`PlatformEdge`). A new gateway is used from its first
 * successful check.
 */
export class EdgeUpstreams {
  private static readonly CHECK_TIMEOUT_MS = 800;

  private healthy: string[] = [];
  private readonly active = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly host: string,
    /** The port checked — the gateway's plain HTTP port, which answers whenever it accepts at all. */
    private readonly checkPort: number,
    private readonly intervalMs = 1_000,
    private readonly resolve: (host: string) => Promise<string[]> = async (name) => (await dns.promises.lookup(name, { all: true })).map((entry) => entry.address),
  ) {}

  start(): void {
    void this.check();
    this.timer = setInterval(() => void this.check(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Healthy gateways, the least busy first, leaving out any this connection already tried. */
  candidates(tried: ReadonlySet<string>): string[] {
    return this.healthy.filter((address) => !tried.has(address)).sort((a, b) => (this.active.get(a) ?? 0) - (this.active.get(b) ?? 0));
  }

  /** A connection to `address` opened (+1) or closed (-1). */
  count(address: string, delta: number): void {
    this.active.set(address, Math.max(0, (this.active.get(address) ?? 0) + delta));
  }

  /** A connection to `address` was refused: out of rotation until its next successful check. */
  refused(address: string): void {
    if (!this.healthy.includes(address)) return;
    this.healthy = this.healthy.filter((entry) => entry !== address);
    console.log(`[edge] gateway ${address} refused a connection (stopping?); out of rotation until it answers again — answering: ${this.healthy.length ? this.healthy.join(', ') : 'none'}`);
  }

  get healthyCount(): number {
    return this.healthy.length;
  }

  async check(): Promise<void> {
    let addresses: string[] = [];
    try {
      addresses = await this.resolve(this.host);
    } catch {
      addresses = [];
    }
    const results = await Promise.all(addresses.map(async (address) => ((await EdgeUpstreams.accepts(address, this.checkPort)) ? address : null)));
    const next = results.filter((address): address is string => address !== null).sort();
    const before = this.healthy.join(',');
    this.healthy = next;
    if (next.join(',') !== before) console.log(`[edge] gateways answering: ${next.length ? next.join(', ') : 'none'}`);
  }

  private static accepts(address: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect({ host: address, port });
      const done = (ok: boolean): void => { socket.destroy(); resolve(ok); };
      socket.setTimeout(EdgeUpstreams.CHECK_TIMEOUT_MS, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  }
}
