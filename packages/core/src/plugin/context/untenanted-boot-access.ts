import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantScopedTableDdl } from '@core/database/tenant-scoped-table-ddl';

/**
 * What happens when a plugin touches tenant data at BOOT, where there is no tenant.
 *
 * In a request this is a hard failure — an untenanted query must never widen to every tenant. But
 * plugin `onInit` legitimately runs outside any request, and several plugins do one-off data
 * normalisation there. Failing those outright takes the whole plugin down (it did: ecommerce and
 * mlm stopped registering), and letting them run unscoped is the leak this design exists to prevent.
 *
 * So during plugin registration only, such a call is SKIPPED and logged loudly, naming the plugin,
 * the method and the table. The plugin stays active; the work does not silently appear to succeed.
 * Several plugins already do exactly this for themselves — this makes it uniform rather than a
 * matter of which plugin author remembered to catch.
 *
 * Per-tenant boot work is T2 (per-tenant plugin lifecycle) and is deliberately not attempted here.
 */
export class UntenantedBootAccess {
  private static readonly logger = new Logger({ namespace: 'plugin-tenancy' });

  /** Empty results by method — matched to what each database method returns. */
  private static readonly EMPTY: Record<string, unknown> = {
    find: [], groupCount: [], findOne: null, count: 0,
    insert: null, update: null, upsert: null, delete: false,
  };

  /**
   * True when this call is happening OUTSIDE any request, against a tenant-scoped table.
   *
   * The signal is the absence of a request store, not a boot flag. Inside a request there is always
   * a store (it carries the locale), so:
   *   - store present, no tenant  -> a real bug in the request path; still THROWS, fail closed.
   *   - no store at all           -> boot, a deferred seed, a scheduled job; skip and say so.
   * That distinction is what keeps requests strict while letting background work survive.
   */
  static shouldSkip(table: unknown): boolean {
    if (!TenantMode.isEnabled()) return false;
    if (RequestContextUtils.storage.getStore()) return false;
    return TenantScopedTableDdl.isTenantScoped(String(table ?? ''));
  }

  /**
   * Records the skip and returns the empty result for that method, as a PROMISE — every database
   * method is async and callers chain `.catch()`/`.then()` on the result. Returning a bare value
   * here broke ecommerce and mlm with "…find(...).catch is not a function".
   */
  static skip(pluginSlug: string, method: string, table: unknown): Promise<unknown> {
    UntenantedBootAccess.logger.warn(
      `[${pluginSlug}] skipped context.db.${method} on "${String(table)}" outside a request: this deployment `
      + 'is multi-tenant and this code path has no tenant, so the call would be ambiguous. '
      + 'Move per-tenant work out of onInit; it is not run for any tenant.',
    );
    return Promise.resolve(UntenantedBootAccess.EMPTY[method] ?? null);
  }
}
