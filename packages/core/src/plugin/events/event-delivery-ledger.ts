import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';

/** One failing (event, plugin, site), as the console lists it. */
export interface IEventDeliveryFailure {
  id: number | string;
  event: string;
  pluginSlug: string;
  tenantId: number | null;
  attempts: number;
  error: string;
  payload: unknown;
  updatedAt: string;
}

/**
 * The record of announced events a plugin listener failed to handle — the thing that turns a swallowed
 * `console.error` into a row an operator can see and retry.
 *
 * ONE row per (event, plugin, site) while it is failing: a repeat raises `attempts` instead of adding a
 * row. It flips to `resolved` the moment that listener next handles the event — a retry, or, within the
 * running process, the next live emit (a small in-memory set keeps the success path from touching the
 * database on every event; across a restart a stale row waits for a retry rather than clearing itself on
 * an unrelated success, which is the safer default). Every write is best-effort: the ledger must never be
 * the reason a delivery path throws.
 */
export class EventDeliveryLedger {
  private static get table(): string {
    return SystemConstants.TABLE.EVENT_DELIVERIES;
  }

  /** (event, plugin, tenant) currently known to be failing, so success clears the DB only when needed. */
  private static readonly failing = new Set<string>();

  private static keyOf(event: string, pluginSlug: string, tenantId: number | null): string {
    return `${event}\u0000${pluginSlug}\u0000${tenantId ?? ''}`;
  }

  private static currentTenant(): number | null {
    try {
      const raw = RequestContextUtils.getTenantId();
      const id = raw ? Number(raw) : NaN;
      return Number.isFinite(id) ? id : null;
    } catch {
      return null;
    }
  }

  private static serialize(payload: unknown): string | null {
    if (payload === undefined) return null;
    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  }

  /** Record (or raise the attempt count of) a listener failure. Never throws. */
  static async recordFailure(
    manager: IPluginManagerInterface,
    input: { event: string; pluginSlug: string; payload: unknown; error: unknown },
  ): Promise<void> {
    const db: any = (manager as any)?.db;
    if (!db) return;
    const tenantId = EventDeliveryLedger.currentTenant();
    const message = String((input.error as any)?.message ?? input.error ?? '').slice(0, 2000);
    try {
      const existing = await db.findOne(EventDeliveryLedger.table, {
        event: input.event, plugin_slug: input.pluginSlug, tenant_id: tenantId, status: 'failed',
      });
      if (existing) {
        await db.update(EventDeliveryLedger.table, { id: existing.id }, {
          attempts: Number(existing.attempts ?? 1) + 1,
          error: message,
          payload: EventDeliveryLedger.serialize(input.payload),
          updated_at: new Date(),
        });
      } else {
        await db.insert(EventDeliveryLedger.table, {
          event: input.event, plugin_slug: input.pluginSlug, tenant_id: tenantId,
          status: 'failed', attempts: 1,
          payload: EventDeliveryLedger.serialize(input.payload),
          error: message, created_at: new Date(), updated_at: new Date(),
        });
      }
      EventDeliveryLedger.failing.add(EventDeliveryLedger.keyOf(input.event, input.pluginSlug, tenantId));
    } catch {
      // Best effort: a ledger write must not take down the delivery path.
    }
  }

  /** Clear a listener's failure once it handles the event again. No DB hit unless a failure is known. */
  static async markResolved(manager: IPluginManagerInterface, input: { event: string; pluginSlug: string }): Promise<void> {
    const tenantId = EventDeliveryLedger.currentTenant();
    const key = EventDeliveryLedger.keyOf(input.event, input.pluginSlug, tenantId);
    if (!EventDeliveryLedger.failing.has(key)) return;
    EventDeliveryLedger.failing.delete(key);
    const db: any = (manager as any)?.db;
    if (!db) return;
    try {
      await db.update(
        EventDeliveryLedger.table,
        { event: input.event, plugin_slug: input.pluginSlug, tenant_id: tenantId, status: 'failed' },
        { status: 'resolved', updated_at: new Date() },
      );
    } catch {
      // Best effort.
    }
  }

  /** The currently-failing deliveries, newest first, for the console. */
  static async listOpenFailures(manager: IPluginManagerInterface, limit = 100): Promise<IEventDeliveryFailure[]> {
    const db: any = (manager as any)?.db;
    if (!db) return [];
    try {
      const rows = await db.find(EventDeliveryLedger.table, { status: 'failed' }, { orderBy: { updated_at: 'desc' }, limit });
      return (rows || []).map((row: any) => EventDeliveryLedger.toFailure(row));
    } catch {
      return [];
    }
  }

  /** One recorded delivery by id (for a retry). */
  static async get(manager: IPluginManagerInterface, id: number | string): Promise<IEventDeliveryFailure | null> {
    const db: any = (manager as any)?.db;
    if (!db) return null;
    try {
      const row = await db.findOne(EventDeliveryLedger.table, { id });
      return row ? EventDeliveryLedger.toFailure(row) : null;
    } catch {
      return null;
    }
  }

  private static toFailure(row: any): IEventDeliveryFailure {
    let payload: unknown = null;
    try {
      payload = row?.payload ? JSON.parse(String(row.payload)) : null;
    } catch {
      payload = null;
    }
    return {
      id: row.id,
      event: String(row.event ?? ''),
      pluginSlug: String(row.pluginSlug ?? row.plugin_slug ?? ''),
      tenantId: row.tenantId ?? row.tenant_id ?? null,
      attempts: Number(row.attempts ?? 1),
      error: String(row.error ?? ''),
      payload,
      updatedAt: String(row.updatedAt ?? row.updated_at ?? ''),
    };
  }
}
