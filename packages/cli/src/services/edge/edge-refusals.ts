import type { IEdgeRuleSource } from '@cli/services/edge/interfaces/edge-rule-source.interface';

/**
 * Connections refused by the rules: counted per address and reported to the rule source every
 * {@link REPORT_MS} (the platform adds them to Settings → Security → Stopped addresses). Written to the log
 * at most once a minute per address — a scanner hammering the port must not fill the disk.
 */
export class EdgeRefusals {
  static readonly REPORT_MS = 60_000;
  private static readonly MAX_COUNTED = 10_000;
  private readonly counts = new Map<string, number>();
  private readonly logged = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly source: IEdgeRuleSource, private readonly now: () => number = Date.now) {}

  refused(address: string, port: number): void {
    if (this.counts.has(address) || this.counts.size < EdgeRefusals.MAX_COUNTED) this.counts.set(address, (this.counts.get(address) ?? 0) + 1);
    const last = this.logged.get(address) ?? 0;
    if (this.now() - last >= 60_000) {
      if (this.logged.size >= EdgeRefusals.MAX_COUNTED) this.logged.clear();
      this.logged.set(address, this.now());
      console.log(`[edge] :${port} refused ${address} (stopped or blocked); further refusals of it are counted, not logged, for a minute`);
    }
  }

  start(): void {
    this.timer = setInterval(() => { void this.flush(); }, EdgeRefusals.REPORT_MS);
    this.timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }

  async flush(): Promise<void> {
    if (!this.counts.size) return;
    const refused = Object.fromEntries(this.counts);
    this.counts.clear();
    await this.source.report(refused).catch(() => undefined);
  }
}
