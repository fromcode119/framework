import fs from 'fs';
import http from 'http';

/**
 * Ends the gateway when it has stopped answering, or is about to, so Docker (`restart: unless-stopped`)
 * starts a fresh one.
 *
 * On 2026-11-01 the gateway reached its memory limit and went into swap. It still accepted every
 * connection and still finished some, but so slowly that every site hung for two hours — and nothing
 * restarts a container that is running. So every `intervalMs` the gateway checks itself, two ways:
 *
 *  - it requests its own health path, which must answer within `timeoutMs`;
 *  - when that answer was slow (over `SLOW_MS`), it reads its container's memory (cgroup v2): memory the
 *    process owns at `ANON_SHARE` of the limit, or `SWAP_BYTES` in swap, is the state that hung it, even
 *    while the odd request still squeezes through.
 *
 * Memory alone never counts. Visitors can raise it — open many connections — and a gateway that holds a
 * lot but still answers promptly is doing its job; ending it would hand them a restart. And swap can hold
 * cold pages that cost nothing. Only memory that comes WITH slowness is the failure seen on 2026-11-01.
 *
 * After `limit` failed checks in a row it logs why and calls `onHung`, which stops the gateway gracefully
 * and exits. Half a minute of failures, not one: a gateway that is merely busy is never ended for it.
 */
export class GatewayWatchdog {
  static readonly INTERVAL_MS = 10_000;
  static readonly TIMEOUT_MS = 5_000;
  static readonly LIMIT = 3;
  static readonly ANON_SHARE = 0.85;
  static readonly SWAP_BYTES = 8 * 1024 * 1024;
  /** A health answer slower than this is what makes memory pressure count. A healthy one takes milliseconds. */
  static readonly SLOW_MS = 1_000;
  private static readonly CGROUP = '/sys/fs/cgroup';

  private failures = 0;
  private timer: NodeJS.Timeout | null = null;
  private checking = false;

  constructor(
    private readonly port: number,
    private readonly path: string,
    private readonly onHung: (reason: string) => void,
    private readonly intervalMs = GatewayWatchdog.INTERVAL_MS,
    private readonly timeoutMs = GatewayWatchdog.TIMEOUT_MS,
    private readonly limit = GatewayWatchdog.LIMIT,
    /** A file under the container's cgroup, or null when it cannot be read (no cgroup v2, no limit). */
    private readonly readCgroup: (file: string) => string | null = GatewayWatchdog.readCgroupFile,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.check(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async check(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    const startedAt = Date.now();
    const answered = await GatewayWatchdog.answers(this.port, this.path, this.timeoutMs);
    const tookMs = Date.now() - startedAt;
    const pressure = answered && tookMs > GatewayWatchdog.SLOW_MS ? this.memoryPressure() : null;
    this.checking = false;
    if (!this.timer) return;
    const problem = !answered ? `no answer from its own health check in ${tookMs} ms` : pressure ? `${pressure}, and its health check took ${tookMs} ms` : null;
    if (!problem) { this.failures = 0; return; }
    this.failures += 1;
    console.warn(`[platform-gateway] watchdog: ${problem} (${this.failures}/${this.limit})`);
    if (this.failures < this.limit) return;
    this.stop();
    this.onHung(`${problem}, ${this.limit} checks in a row`);
  }

  /** What is wrong with the container's memory, or null when it is fine or cannot be read. */
  memoryPressure(): string | null {
    const max = Number(this.readCgroup('memory.max'));
    if (!Number.isFinite(max) || max <= 0) return null;
    const anon = Number(/^anon (\d+)$/m.exec(this.readCgroup('memory.stat') ?? '')?.[1]);
    const swap = Number(this.readCgroup('memory.swap.current') ?? 0);
    const mib = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MiB`;
    if (swap >= GatewayWatchdog.SWAP_BYTES) return `${mib(swap)} in swap`;
    if (Number.isFinite(anon) && anon >= max * GatewayWatchdog.ANON_SHARE) return `memory at ${mib(anon)} of its ${mib(max)} limit`;
    return null;
  }

  private static readCgroupFile(file: string): string | null {
    try {
      return fs.readFileSync(`${GatewayWatchdog.CGROUP}/${file}`, 'utf8').trim();
    } catch {
      return null;
    }
  }

  private static answers(port: number, path: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const request = http.get({ host: '127.0.0.1', port, path, agent: false, timeout: timeoutMs }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      request.on('timeout', () => { request.destroy(); resolve(false); });
      request.on('error', () => resolve(false));
    });
  }
}
