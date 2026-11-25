import { SystemConstants } from '@core/constants/system.constants';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { EdgeStop } from '@core/security/edge/edge-stop';
import type { IEdgeStopRecord } from '@core/security/edge/interfaces/edge-stop-record.interface';
import type { IEdgeStopReport } from '@core/security/edge/interfaces/edge-stop-report.interface';

/**
 * The stopped addresses (`_system_edge_stops`): written when the gateway reports a stop, read by the
 * routing map (so the gateway keeps refusing them after a restart) and by Settings → Security → Stopped
 * addresses, where an operator releases one or blocks it for good.
 *
 * The raw manager database answers in the table's own snake_case column names.
 *
 * A bounded window of the newest rows is read and filtered here rather than with a `where` on
 * `released_at IS NULL` — the raw where-builder compiles `null` to `= NULL`, which matches nothing.
 */
export class EdgeStopStore {
  private static readonly TABLE = SystemConstants.TABLE.EDGE_STOPS;
  /** The newest stops kept in view. A scanner wave is hundreds, not tens of thousands. */
  static readonly WINDOW = 500;
  /** How long a release is carried to the gateway: longer than any stop it could end. */
  static readonly RELEASED_WINDOW_MS = 31 * 24 * 60 * 60_000;
  /** What one report may carry, so a report cannot fill a row with anything it likes. */
  private static readonly MAX_LIST = 10;
  private static readonly MAX_ENTRY = 200;

  constructor(private readonly db: any, private readonly now: () => number = Date.now) {}

  /**
   * Records a stop the gateway made. A second report for an address still stopped (two gateways side by
   * side during a deploy) extends that row instead of adding another. Null when the report is unusable.
   */
  async record(report: IEdgeStopReport): Promise<IEdgeStopRecord | null> {
    const address = NetworkAddressUtils.subscriber(report.address);
    const until = Date.parse(String(report.until ?? ''));
    if (!address || NetworkAddressUtils.isPrivate(NetworkAddressUtils.normalize(report.address)) || !Number.isFinite(until) || until <= this.now()) return null;
    const hosts = EdgeStopStore.list(report.hosts);
    const paths = EdgeStopStore.list(report.paths);
    const reason = String(report.reason ?? '').slice(0, EdgeStopStore.MAX_ENTRY) || 'scanner_stopped';
    const strikes = Math.max(0, Math.floor(Number(report.strikes) || 0));
    const open = (await this.active()).find((stop) => stop.address === address);
    if (open) {
      await this.db.update(EdgeStopStore.TABLE, { id: open.id }, {
        until_at: new Date(Math.max(until, Date.parse(open.until))).toISOString(),
        hosts: JSON.stringify(EdgeStopStore.merge(open.hosts, hosts)),
        paths: JSON.stringify(EdgeStopStore.merge(open.paths, paths)),
        strikes: Math.max(open.strikes, strikes),
      });
      return { ...open, until: new Date(Math.max(until, Date.parse(open.until))).toISOString(), isNew: false };
    }
    await this.db.insert(EdgeStopStore.TABLE, {
      address,
      reason,
      strikes,
      refused: 0,
      hosts: JSON.stringify(hosts),
      paths: JSON.stringify(paths),
      stopped_at: new Date(this.now()).toISOString(),
      until_at: new Date(until).toISOString(),
    });
    const created = (await this.active()).find((stop) => stop.address === address);
    return created ? { ...created, isNew: true } : null;
  }

  /** Adds requests the gateway refused from stopped addresses, by address. */
  async addRefused(counts: Record<string, unknown>): Promise<void> {
    const active = await this.active();
    for (const [raw, value] of Object.entries(counts ?? {})) {
      const address = NetworkAddressUtils.subscriber(raw);
      const count = Math.max(0, Math.floor(Number(value) || 0));
      const stop = active.find((entry) => entry.address === address);
      if (!stop || !count) continue;
      await this.db.update(EdgeStopStore.TABLE, { id: stop.id }, { refused: stop.refused + count });
    }
  }

  /** Every stop in view, the newest first. */
  async list(): Promise<IEdgeStopRecord[]> {
    const rows = (await this.db.find(EdgeStopStore.TABLE, { orderBy: { id: 'desc' }, limit: EdgeStopStore.WINDOW })) || [];
    return rows.map((row: any) => this.toRecord(row));
  }

  /**
   * The stops in force: not released, not yet ended. Asked of the database directly, never filtered
   * from the window {@link list} shows — a wave of newer stops must not push an older one out of force.
   */
  async active(): Promise<IEdgeStopRecord[]> {
    const rows = await this.db.find(EdgeStopStore.TABLE, {
      where: { released_at: null, until_at: { gt: new Date(this.now()).toISOString() } },
      orderBy: { id: 'desc' },
    });
    return (rows || []).map((row: any) => this.toRecord(row));
  }

  /** What the routing map carries to the gateway. */
  async stops(): Promise<EdgeStop[]> {
    return (await this.active()).map((stop) => new EdgeStop(stop.address, Date.parse(stop.until)));
  }

  /**
   * The stops an operator ended early within {@link RELEASED_WINDOW_MS}, with when — so the gateway ends
   * its own copy of each, and only a copy older than the release. A stop the map merely does not list
   * (its report was lost) is never ended this way.
   */
  async released(): Promise<EdgeStop[]> {
    const rows = await this.db.find(EdgeStopStore.TABLE, {
      where: { released_at: { gt: new Date(this.now() - EdgeStopStore.RELEASED_WINDOW_MS).toISOString() } },
      orderBy: { id: 'desc' },
    });
    return (rows || []).map((row: any) => new EdgeStop(String(row.address ?? ''), Date.parse(EdgeStopStore.iso(row.released_at))));
  }

  async find(id: number): Promise<IEdgeStopRecord | null> {
    const row = await this.db.findOne(EdgeStopStore.TABLE, { id });
    return row ? this.toRecord(row) : null;
  }

  /** Ends a stop early. `action` says what the operator did: released it, or blocked it for good. */
  async release(id: number, by: string, action: string): Promise<boolean> {
    const stop = await this.find(id);
    if (!stop || !stop.active) return false;
    await this.db.update(EdgeStopStore.TABLE, { id }, { released_at: new Date(this.now()).toISOString(), released_by: by.slice(0, EdgeStopStore.MAX_ENTRY), release_action: action });
    return true;
  }

  private toRecord(row: any): IEdgeStopRecord {
    const until = EdgeStopStore.iso(row.until_at);
    const releasedAt = EdgeStopStore.iso(row.released_at);
    return {
      id: Number(row.id),
      address: String(row.address ?? ''),
      reason: String(row.reason ?? ''),
      strikes: Number(row.strikes ?? 0),
      refused: Number(row.refused ?? 0),
      hosts: EdgeStopStore.parse(row.hosts),
      paths: EdgeStopStore.parse(row.paths),
      stoppedAt: EdgeStopStore.iso(row.stopped_at),
      until,
      releasedAt,
      releasedBy: String(row.released_by ?? ''),
      releaseAction: String(row.release_action ?? ''),
      active: !releasedAt && Date.parse(until) > this.now(),
    };
  }

  private static iso(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    const time = value instanceof Date ? value.getTime() : Date.parse(String(value));
    return Number.isFinite(time) ? new Date(time).toISOString() : '';
  }

  private static parse(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    try {
      const parsed = JSON.parse(String(value ?? '[]'));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private static list(value: unknown): string[] {
    return EdgeStopStore.merge([], Array.isArray(value) ? value.map(String) : []);
  }

  private static merge(first: readonly string[], second: readonly string[]): string[] {
    const out: string[] = [];
    for (const entry of [...first, ...second]) {
      const clean = entry.trim().slice(0, EdgeStopStore.MAX_ENTRY);
      if (clean && !out.includes(clean) && out.length < EdgeStopStore.MAX_LIST) out.push(clean);
    }
    return out;
  }
}
