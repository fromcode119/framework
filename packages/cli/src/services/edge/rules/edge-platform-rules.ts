import fs from 'fs';
import path from 'path';
import { EdgeControlPaths, EdgeRuleSnapshot } from '@fromcode119/core';
import { EdgeControlClient } from '@cli/services/edge/platform/edge-control-client';
import type { EdgeIdentityStore } from '@cli/services/edge/platform/edge-identity-store';
import type { IEdgeRuleSource } from '@cli/services/edge/interfaces/edge-rule-source.interface';

/**
 * `rules.source: fromcode` — the rules from the platform this edge joined, over its control channel.
 *
 * A long poll that names the version it holds, so a change arrives within about a second and nothing is
 * fetched when nothing changed. Every snapshot is written to `rules.json` in the state directory and read
 * back at start: an edge restarted while the platform is out of reach still refuses what it refused
 * before, and ends each stop on time by itself. On failure it waits 1, 2, 4 … up to 30 s between tries.
 */
export class EdgePlatformRules implements IEdgeRuleSource {
  /** How long the rules count as current after the last answer from the platform. */
  static readonly FRESH_MS = EdgeControlPaths.RULES_WAIT_MS * 2 + 15_000;
  private static readonly MAX_BACKOFF_MS = 30_000;
  current = EdgeRuleSnapshot.of([], [], 0);
  private lastContact = 0;
  private running = false;
  private backoff = 1_000;

  constructor(
    private readonly identity: EdgeIdentityStore,
    private readonly directory: string,
    private readonly version: string,
    private readonly now: () => number = Date.now,
  ) {}

  get fresh(): boolean {
    return this.now() - this.lastContact < EdgePlatformRules.FRESH_MS;
  }

  start(): void {
    const kept = this.readKept();
    if (kept) { this.current = kept; console.log(`[edge] rules kept from ${this.file}: ${kept.stops.length} stopped, ${kept.blocked.length} blocked`); }
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  async report(refused: Record<string, number>): Promise<void> {
    if (!Object.keys(refused).length) return;
    const answer = await this.call('POST', EdgeControlPaths.REPORTS, { refused });
    if (answer?.status !== 200) console.warn(`[edge] the platform did not take the refusal report (HTTP ${answer?.status || 'none'})`);
  }

  private async loop(): Promise<void> {
    while (this.running) {
      // The first question names no version, so it is answered at once: naming the one it started with
      // (empty, or kept on disk) would hold an unchanged answer for the whole long poll, and the edge
      // would report itself not ready for that long after every start.
      const known = this.lastContact ? `?known=${encodeURIComponent(this.current.version)}` : '';
      const answer = await this.call('GET', `${EdgeControlPaths.RULES}${known}`, undefined);
      if (answer && (answer.status === 200 || answer.status === 204)) {
        this.lastContact = this.now();
        this.backoff = 1_000;
        const snapshot = answer.status === 200 ? EdgeRuleSnapshot.fromJson(answer.body) : null;
        if (snapshot && snapshot.version !== this.current.version) this.apply(snapshot);
        continue;
      }
      const why = answer?.status === 403
        ? 'the platform refused this edge — removed in the console, or its certificate ran out; join it again with a new token'
        : `the platform did not answer (HTTP ${answer?.status || 'none'})`;
      console.warn(`[edge] rules: ${why}; the rules in force stay, next try in ${this.backoff / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, this.backoff));
      this.backoff = Math.min(this.backoff * 2, EdgePlatformRules.MAX_BACKOFF_MS);
    }
  }

  private apply(snapshot: EdgeRuleSnapshot): void {
    this.current = snapshot;
    try {
      fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
      fs.writeFileSync(`${this.file}.new`, JSON.stringify(snapshot.toJSON()));
      fs.renameSync(`${this.file}.new`, this.file);
    } catch (error: any) {
      console.warn(`[edge] could not keep the rules on disk: ${error?.message}`);
    }
    console.log(`[edge] rules ${snapshot.version.slice(0, 8)}: ${snapshot.stops.length} stopped, ${snapshot.blocked.length} blocked`);
  }

  private call(method: string, target: string, body: unknown) {
    const control = this.identity.control;
    const tls = this.identity.tls;
    if (!control || !tls) return Promise.resolve(null);
    return new EdgeControlClient(control.host, control.port, this.version).request(method, target, body, tls);
  }

  private get file(): string {
    return path.join(this.directory, 'rules.json');
  }

  private readKept(): EdgeRuleSnapshot | null {
    try { return EdgeRuleSnapshot.fromJson(JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch { return null; }
  }
}
