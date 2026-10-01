import { Logger } from '@fromcode119/core';
import { DatabasePoolRegistry } from '@fromcode119/database';

/**
 * Says when requests are queued for a database connection.
 *
 * A request waiting for a pool connection runs no query and uses no CPU, so from Postgres and from
 * the container's load it looks like nothing is happening — which is exactly how the storefront's
 * 12-second timeouts looked. Sampled twice a second. A pool briefly full is normal, so it warns only
 * once requests have been queued for two seconds running, then at most every five seconds, naming
 * each pool's counters and the setting that sizes it.
 */
export class DatabasePoolWatch {
  static readonly SAMPLE_MS = 500;
  static readonly REPORT_EVERY_MS = 5_000;
  /** A wait shorter than this is a busy moment, not a shortage: four samples in a row, two seconds. */
  static readonly SUSTAINED_SAMPLES = 4;

  /** One watch per process, however many times the server setup that starts it runs. */
  private static running = false;
  private lastReport = 0;
  private waitingSamples = 0;

  constructor(private readonly logger: Logger = new Logger({ namespace: 'db-pool' })) {}

  start(): void {
    if (DatabasePoolWatch.running) return;
    DatabasePoolWatch.running = true;
    setInterval(() => this.sample(), DatabasePoolWatch.SAMPLE_MS).unref?.();
  }

  /** One sample; returns the line it logged, or null. */
  sample(now: number = Date.now()): string | null {
    const pools = DatabasePoolRegistry.snapshots();
    this.waitingSamples = pools.some((pool) => pool.waiting > 0) ? this.waitingSamples + 1 : 0;
    if (this.waitingSamples < DatabasePoolWatch.SUSTAINED_SAMPLES || now - this.lastReport < DatabasePoolWatch.REPORT_EVERY_MS) return null;
    this.lastReport = now;
    const line = pools.map((pool) => `${pool.name}: ${pool.waiting} waiting, ${pool.total} of ${pool.max} open, ${pool.idle} idle`).join('; ');
    this.logger.warn(`Requests have waited over 2 s for a database connection (${line}) — Settings → Infrastructure → Database connections`);
    return line;
  }
}
