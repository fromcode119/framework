import dns from 'dns';
import http from 'http';
import net from 'net';
import { RouteConstants } from '@fromcode119/core';

/**
 * The gateways `edge` may send a connection to: every address the gateway's name resolves to (Docker's
 * DNS lists one per running container), each checked about every second by asking for its health path.
 *
 * ANSWERING, not just accepting: a gateway out of memory and in swap still completes the TCP handshake
 * and then answers nothing — on 2026-11-01 one did that for two hours, and a check that only connected
 * kept sending it every visitor. A gateway that accepts but does not answer leaves the rotation while
 * another answers. When none answers, the ones that still accept stay in it: a gateway that is merely
 * slow is better than refusing every visitor, and a hung one ends itself (`GatewayWatchdog`).
 *
 * When none even accepts its check, every address last resolved is still offered, as a last resort:
 * a check is one connection under a short timeout, and across a network (the relay in front of the
 * platform reaches its gateway over the internet) a lossy link fails checks while most connections
 * still get through. On 2026-11-04 such a link flipped the relay's only gateway in and out of
 * rotation every two seconds for eight minutes, and each moment out of rotation refused every
 * visitor outright. A visitor is refused only when nothing is resolved at all, or every address was
 * tried and refused.
 *
 * A gateway being replaced stops accepting first (`GatewayListener.stop`), so its check fails within
 * a second and new connections go to the one replacing it; a connection that still reaches it in that
 * second is refused and retried elsewhere (`PlatformEdge`). A new gateway is used from its first
 * successful check.
 */
export class EdgeUpstreams {
  private static readonly CONNECT_TIMEOUT_MS = 800;
  private static readonly ANSWER_TIMEOUT_MS = 2_000;
  private static readonly HEALTH_PATH = RouteConstants.SEGMENTS.GATEWAY_HEALTH;

  private healthy: string[] = [];
  /** Every address the last successful lookup returned, checked or not — the last resort. */
  private known: string[] = [];
  private readonly active = new Map<string, number>();
  private readonly silent = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly host: string,
    /** The port checked — the gateway's plain HTTP port, which serves its health path. */
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

  /**
   * Healthy gateways, the least busy first, leaving out any this connection already tried. When none
   * is healthy, every known gateway not yet tried: a connection that may get through beats a refusal
   * that certainly does not.
   */
  candidates(tried: ReadonlySet<string>): string[] {
    const pool = this.healthy.length ? this.healthy : this.known;
    return pool.filter((address) => !tried.has(address)).sort((a, b) => (this.active.get(a) ?? 0) - (this.active.get(b) ?? 0));
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

  /** One check of every gateway; a call while one is running waits for that one. */
  check(): Promise<void> {
    this.inFlight ??= this.checkAll().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async checkAll(): Promise<void> {
    let addresses: string[] = [];
    try {
      addresses = await this.resolve(this.host);
    } catch {
      addresses = [];
    }
    if (addresses.length) this.known = [...addresses].sort();
    const results = await Promise.all(addresses.map(async (address) => ({ address, ...(await EdgeUpstreams.probe(address, this.checkPort)) })));
    const answering = results.filter((result) => result.answered).map((result) => result.address).sort();
    const accepting = results.filter((result) => result.accepted).map((result) => result.address).sort();
    for (const result of results) {
      if (result.accepted && !result.answered && !this.silent.has(result.address)) console.warn(`[edge] gateway ${result.address} accepts connections but did not answer its health check in ${EdgeUpstreams.ANSWER_TIMEOUT_MS} ms`);
    }
    this.silent.clear();
    for (const result of results) if (result.accepted && !result.answered) this.silent.add(result.address);
    const next = answering.length ? answering : accepting;
    const before = this.healthy.join(',');
    this.healthy = next;
    if (next.join(',') !== before) console.log(`[edge] gateways answering: ${next.length ? next.join(', ') : 'none'}${answering.length || !next.length ? '' : ' (accepting only — none answered its health check)'}`);
  }

  /** Whether the port took the connection, and whether the health path then came back 200 in time. */
  private static probe(address: string, port: number): Promise<{ accepted: boolean; answered: boolean }> {
    return new Promise((resolve) => {
      let connected = false;
      const request = http.get({ host: address, port, path: EdgeUpstreams.HEALTH_PATH, agent: false });
      const finish = (answered: boolean): void => { clearTimeout(timer); request.destroy(); resolve({ accepted: connected, answered }); };
      const timer = setTimeout(() => finish(false), EdgeUpstreams.ANSWER_TIMEOUT_MS);
      request.once('socket', (socket: net.Socket) => {
        const connectTimer = setTimeout(() => { if (!connected) finish(false); }, EdgeUpstreams.CONNECT_TIMEOUT_MS);
        socket.once('connect', () => { connected = true; clearTimeout(connectTimer); });
        socket.once('close', () => clearTimeout(connectTimer));
      });
      request.once('response', (res) => { res.resume(); finish(res.statusCode === 200); });
      request.on('error', () => finish(false));
    });
  }
}
