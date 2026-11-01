import http from 'http';

/**
 * Ends the gateway when it has stopped answering, so Docker (`restart: unless-stopped`) starts a fresh one.
 *
 * A gateway that is out of memory and in swap still ACCEPTS connections — the kernel completes the TCP
 * handshake — but answers nothing: on 2026-11-01 one sat like that for two hours and every site hung,
 * while `edge`, which then saw only that the port was open, kept sending it every visitor. Nothing else
 * restarts a container that is running but hung, so the gateway asks itself: every `intervalMs` it
 * requests its own health path, and after `limit` answers in a row that did not come within `timeoutMs`
 * it logs why and calls `onHung` (the process exits).
 *
 * The bar is deliberately low and slow — any answer to a trivial request, three times running, about half
 * a minute — so a busy gateway is never ended for being busy.
 */
export class GatewayWatchdog {
  static readonly INTERVAL_MS = 10_000;
  static readonly TIMEOUT_MS = 5_000;
  static readonly LIMIT = 3;

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
    this.checking = false;
    if (!this.timer) return;
    if (answered) { this.failures = 0; return; }
    this.failures += 1;
    console.warn(`[platform-gateway] watchdog: no answer from its own health check in ${Date.now() - startedAt} ms (${this.failures}/${this.limit})`);
    if (this.failures < this.limit) return;
    this.stop();
    this.onHung(`no answer to ${this.limit} health checks in a row, each given ${this.timeoutMs} ms`);
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
