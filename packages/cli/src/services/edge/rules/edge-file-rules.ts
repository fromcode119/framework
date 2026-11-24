import fs from 'fs';
import YAML from 'yaml';
import { EdgeRuleSnapshot, EdgeStop, NetworkAddressUtils } from '@fromcode119/core';
import type { IEdgeRuleSource } from '@cli/services/edge/interfaces/edge-rule-source.interface';

/**
 * `rules.source: file` — for an edge in front of servers that are not a Fromcode platform. The file:
 *
 * ```yaml
 * blocked: [192.0.2.0/24, 198.51.100.7]
 * stops: [{ address: 203.0.113.9, until: 2026-12-01T00:00:00Z }]
 * ```
 *
 * Read again whenever it changes (checked every {@link CHECK_MS}). A file that cannot be read or has a bad
 * entry is reported and the rules in force are KEPT — a typo never opens the door.
 */
export class EdgeFileRules implements IEdgeRuleSource {
  static readonly CHECK_MS = 2_000;
  current = EdgeRuleSnapshot.of([], [], 0);
  fresh = false;
  private stamp = '';
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string, private readonly now: () => number = Date.now) {}

  start(): void {
    this.read();
    this.timer = setInterval(() => this.read(), EdgeFileRules.CHECK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async report(refused: Record<string, number>): Promise<void> {
    const total = Object.values(refused).reduce((sum, count) => sum + count, 0);
    if (total) console.log(`[edge] refused ${total} connection(s) from ${Object.keys(refused).length} address(es) by ${this.file}`);
  }

  /** Reads the file when it changed; returns the problems found, if any. */
  read(): string[] {
    let stat: fs.Stats;
    try { stat = fs.statSync(this.file); } catch { this.fail('missing', [`${this.file} cannot be read`]); return ['missing']; }
    const stamp = `${stat.mtimeMs}:${stat.size}`;
    if (stamp === this.stamp) return [];
    let raw: any;
    try { raw = YAML.parse(fs.readFileSync(this.file, 'utf8')) ?? {}; } catch (error: any) { this.fail(stamp, [`not valid YAML or JSON: ${error?.message}`]); return ['invalid']; }
    const problems: string[] = [];
    const blocked = (Array.isArray(raw.blocked) ? raw.blocked : raw.blocked === undefined ? [] : (problems.push('blocked: a list'), [])).map(String);
    for (const entry of blocked) if (!NetworkAddressUtils.isAddressOrBlock(entry)) problems.push(`blocked: "${entry}" is not an address or block`);
    const stops = (Array.isArray(raw.stops) ? raw.stops : raw.stops === undefined ? [] : (problems.push('stops: a list'), [])).map((entry: unknown) => {
      const stop = EdgeStop.fromJson(entry);
      if (!stop) problems.push(`stops: ${JSON.stringify(entry)} needs an address and an "until" time`);
      return stop;
    }).filter((stop: EdgeStop | null): stop is EdgeStop => stop !== null);
    if (problems.length) { this.fail(stamp, problems); return problems; }
    this.stamp = stamp;
    this.current = EdgeRuleSnapshot.of(stops, blocked, this.now());
    this.fresh = true;
    console.log(`[edge] rules from ${this.file}: ${this.current.blocked.length} blocked, ${this.current.stops.length} stopped`);
    return [];
  }

  /** Logged once per version of the file, not on every check. */
  private fail(stamp: string, problems: string[]): void {
    this.fresh = false;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    console.error(`[edge] rules file ${this.file} not applied, the previous rules stay in force:\n  - ${problems.join('\n  - ')}`);
  }
}
