import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';

import type { IOnceOutcome } from '@core/plugin/events/interfaces/once-outcome.interface';

/**
 * Run a side effect at most once per key, so the same logical event handled twice does its work once —
 * a retry, or a payment provider that sends its callback twice, does not issue two keys or record two
 * payments. The key is CLAIMED before the effect runs (a UNIQUE index settles a concurrent duplicate to
 * one winner, the other is told it is a duplicate). If the effect throws, its claim is released so it can
 * be tried again; a claim is kept only for an effect that actually completed.
 *
 * Explicit by design: a listener names the `scope` (usually its event + plugin) and the `key` (the order
 * number, the payment id). Nothing is deduplicated by guessing at payloads, which would silently drop a
 * legitimately repeated event.
 */
export class EventIdempotency {
  private static get table(): string {
    return SystemConstants.TABLE.EVENT_DEDUPE;
  }

  /** The site's own id as a string ('' for platform scope). Never coerced to a number — a non-numeric
   * tenant must keep its own bucket, or two sites would dedupe against each other. */
  private static currentTenant(): string {
    try {
      const raw = RequestContextUtils.getTenantId();
      return raw ? String(raw).trim() : '';
    } catch {
      return '';
    }
  }

  /**
   * Claim `key` for `scope`: true when this caller now holds it, false when it is already held. The
   * claim is one row under a UNIQUE index, so of two concurrent callers exactly one is told true —
   * including two processes, which is what an isolated plugin needs and cannot do in its own memory.
   * With no store or no key nothing can be claimed, and the caller is told true so the effect still runs.
   */
  static async claim(manager: IPluginManagerInterface, scope: string, key: string): Promise<boolean> {
    const db: any = (manager as any)?.db;
    if (!db || !scope || !key) return true;

    const where = { scope, dedupe_key: key, tenant_id: EventIdempotency.currentTenant() };
    const existing = await db.findOne(EventIdempotency.table, where).catch(() => null);
    if (existing) return false;
    try {
      await db.insert(EventIdempotency.table, { ...where, created_at: new Date() });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Give a claim back, so the effect may run again: the effect threw, or what it produced was undone
   * (an invoice withdrawn before it reached the customer is issued again when the payment arrives).
   */
  static async release(manager: IPluginManagerInterface, scope: string, key: string): Promise<void> {
    const db: any = (manager as any)?.db;
    if (!db || !scope || !key) return;
    await db.delete(EventIdempotency.table, { scope, dedupe_key: key, tenant_id: EventIdempotency.currentTenant() }).catch(() => {});
  }

  static async once<T>(
    manager: IPluginManagerInterface,
    scope: string,
    key: string,
    fn: () => Promise<T> | T,
  ): Promise<IOnceOutcome<T>> {
    if (!(await EventIdempotency.claim(manager, scope, key))) return { ran: false, skipped: true };

    try {
      return { ran: true, result: await fn() };
    } catch (error) {
      // The effect did not complete, so it must be allowed to run again: release the claim.
      await EventIdempotency.release(manager, scope, key);
      throw error;
    }
  }
}
