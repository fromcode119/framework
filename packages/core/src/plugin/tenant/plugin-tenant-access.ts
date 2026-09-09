import { Logger } from '@core/logging';
import { TenantState } from '@core/enums/tenant-state.enum';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * Does THIS tenant run this plugin?
 *
 * The one place that answers it. Six seams ask the question — routes, global middleware, hook
 * handlers, `context.plugins.isEnabled`, the namespace/public API, and the admin menu — and if each
 * derived the rule for itself they would drift, which for a gate means one of them quietly says yes.
 *
 * THIS IS THE SECOND OF TWO AXES. `plugin.state === ACTIVE` is the platform axis: is the plugin
 * loaded, healthy and not held. This class is the tenant axis. A request may use a plugin only when
 * BOTH are true, and neither overrides the other — a tenant's configuration must not make a plugin
 * held for an integrity failure look usable, and a healthy plugin must not be usable by a customer
 * that does not run it.
 *
 * THE READ IS SYNCHRONOUS, DELIBERATELY. `context.plugins.isEnabled(slug)` is part of the plugin API
 * and returns a boolean today; making it a promise would break every caller. So the tenant's set is
 * loaded ONCE when the request's tenant is resolved (`warm`, from the tenancy middleware) and the
 * gates read it out of memory. That also makes the gate free on the hot path.
 *
 * Invalidating on write is what makes enable/disable take effect on the NEXT REQUEST rather than the
 * next restart.
 */
export class PluginTenantAccess {
  private static readonly logger = new Logger({ namespace: 'plugin-tenancy' });

  /** tenantId -> slugs enabled for it. A missing key means "never successfully loaded". */
  private static cache = new Map<string, Set<string>>();

  private static db: any;

  /** Wired once at boot by the plugin manager, with the request-path connection. */
  static configure(db: unknown): void {
    PluginTenantAccess.db = db;
    PluginTenantAccess.cache = new Map();
  }

  /**
   * Loads a tenant's enabled set if it is not already in memory.
   *
   * Called when a request's tenant is resolved, so the synchronous gates below always have an
   * answer. A failed read does NOT populate the cache — caching a failure would make one transient
   * database error look like a permanent configuration for as long as the process lives.
   */
  static async warm(tenantId: string): Promise<void> {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant || PluginTenantAccess.cache.has(tenant) || !PluginTenantAccess.db) return;

    try {
      const rows = await PluginTenantAccess.db.find(SystemConstants.TABLE.TENANT_PLUGINS, {
        where: { tenant_id: tenant },
      });
      PluginTenantAccess.cache.set(tenant, new Set(
        (rows ?? [])
          .filter((row: any) => String(row?.state ?? '').trim() === TenantState.ACTIVE.value)
          .map((row: any) => String(row?.plugin_slug ?? '').trim())
          .filter((slug: string) => slug.length > 0),
      ));
    } catch (error: any) {
      PluginTenantAccess.logger.warn(
        `Could not read plugin enablement for tenant "${tenant}": ${error?.message || error}. `
        + 'Every plugin is treated as DISABLED for this tenant until a read succeeds.',
      );
    }
  }

  /**
   * Is `slug` enabled for the CURRENT request's tenant?
   *
   * Three cases, and the last two are the ones that matter:
   *  - single-tenant deployment -> true. There is no tenant axis; the platform axis alone decides,
   *                                exactly as before tenancy existed.
   *  - a tenant is bound        -> the stored answer for that tenant.
   *  - multi-tenant, no tenant  -> FALSE. "No tenant" must never mean "every tenant" — that is the
   *                                fail-open shape already closed once in `BaseDialect.withTenant`.
   *    An unloaded tenant lands here too, and false is the right rendering of "we do not know".
   */
  static isEnabledForCurrentTenant(slug: string): boolean {
    if (!TenantMode.isEnabled()) return true;

    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) return false;

    return PluginTenantAccess.enabledSlugsFor(tenantId).has(String(slug ?? '').trim());
  }

  /** What is known about a tenant right now. Empty when it has never been loaded. */
  static enabledSlugsFor(tenantId: string): Set<string> {
    return PluginTenantAccess.cache.get(String(tenantId ?? '').trim()) ?? new Set();
  }

  /** Is `slug` enabled for a NAMED tenant? For the admin, which reads on another tenant's behalf. */
  static async isEnabledFor(slug: string, tenantId: string): Promise<boolean> {
    const tenant = String(tenantId ?? '').trim();
    const name = String(slug ?? '').trim();
    if (!tenant || !name) return false;
    await PluginTenantAccess.warm(tenant);
    return PluginTenantAccess.enabledSlugsFor(tenant).has(name);
  }

  /**
   * Forgets what it knows, so the next request re-reads.
   *
   * Called by every write path. This IS the "no restart" mechanism: the gates are consulted per
   * request, so the only thing between a write and the new behaviour is this cache.
   */
  static invalidate(tenantId?: string): void {
    const tenant = String(tenantId ?? '').trim();
    if (tenant) {
      PluginTenantAccess.cache.delete(tenant);
      return;
    }
    PluginTenantAccess.cache.clear();
  }

  /** Test seam. */
  static reset(): void {
    PluginTenantAccess.cache = new Map();
    PluginTenantAccess.db = undefined;
  }
}
