import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { EventListenerRegistry } from '@core/plugin/events/event-listener-registry';

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

  /** Keys whose VALUE is a secret, redacted before a payload is stored. */
  private static readonly SENSITIVE_KEY = /pass|secret|token|api[-_]?key|authorization|\bauth\b|otp|\bcode\b|\bpin\b|cvv|\bcard\b|ssn|private[-_]?key|credential|cookie|session/i;
  /** Events whose payload is secret by nature: no payload of theirs is stored at all. */
  private static readonly SENSITIVE_EVENT = /(^|[:.])(auth|password|token|secret|credential|session|login|signin|otp)([:.]|$)/i;
  private static readonly MAX_PAYLOAD_CHARS = 8000;

  /**
   * The payload as it is safe to keep: nothing for an auth-type event, secret-named keys replaced with
   * `[redacted]`, and the whole thing capped in size. The ledger is operational metadata, not a place
   * for credentials or bulk PII — a retry re-runs the listener, it does not need the raw secret.
   */
  private static serialize(event: string, payload: unknown): string | null {
    if (payload === undefined) return null;
    if (EventDeliveryLedger.SENSITIVE_EVENT.test(event)) return null;
    try {
      const json = JSON.stringify(EventDeliveryLedger.redact(payload, 0));
      if (json === undefined) return null;
      return json.length > EventDeliveryLedger.MAX_PAYLOAD_CHARS ? `${json.slice(0, EventDeliveryLedger.MAX_PAYLOAD_CHARS)}…` : json;
    } catch {
      return null;
    }
  }

  private static redact(value: unknown, depth: number): unknown {
    if (value === null || value === undefined || depth > 6) return depth > 6 ? undefined : value;
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => EventDeliveryLedger.redact(item, depth + 1));
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = EventDeliveryLedger.SENSITIVE_KEY.test(k) ? '[redacted]' : EventDeliveryLedger.redact(v, depth + 1);
      }
      return out;
    }
    return value;
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
          payload: EventDeliveryLedger.serialize(input.event, input.payload),
          updated_at: new Date(),
        });
      } else {
        await db.insert(EventDeliveryLedger.table, {
          event: input.event, plugin_slug: input.pluginSlug, tenant_id: tenantId,
          status: 'failed', attempts: 1,
          payload: EventDeliveryLedger.serialize(input.event, input.payload),
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

  /** Mark one recorded delivery resolved by its id (used after a successful retry). */
  static async markResolvedById(manager: IPluginManagerInterface, id: number | string): Promise<void> {
    const db: any = (manager as any)?.db;
    if (!db) return;
    try {
      await db.update(EventDeliveryLedger.table, { id }, { status: 'resolved', updated_at: new Date() });
    } catch {
      // Best effort.
    }
  }

  /**
   * Re-run a recorded failure against the plugin's CURRENT listener, inside the site the failure
   * belongs to. A listener that is not registered now (its plugin is off, or never re-subscribed) is
   * reported rather than silently skipped. Success marks the row resolved; a failed retry is recorded by
   * the listener's own wrapper, which raises the attempt count.
   */
  static async retry(manager: IPluginManagerInterface, id: number | string): Promise<{ ok: boolean; error?: string; notFound?: boolean }> {
    const row = await EventDeliveryLedger.get(manager, id);
    if (!row) return { ok: false, notFound: true };

    const handlers = EventListenerRegistry.find(row.event, row.pluginSlug);
    if (!handlers.length) {
      return { ok: false, error: `No active listener for "${row.event}" in "${row.pluginSlug}" — is the plugin enabled?` };
    }

    const run = async () => { for (const handler of handlers) await handler(row.payload, row.event); };
    const db: any = (manager as any)?.db;
    const scoped = row.tenantId != null && db?.withTenant
      ? () => RequestContextUtils.storage.run({ tenantId: String(row.tenantId) }, () => db.withTenant(String(row.tenantId), run))
      : run;

    try {
      await scoped();
      await EventDeliveryLedger.markResolvedById(manager, id);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String((error as any)?.message ?? error) };
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
