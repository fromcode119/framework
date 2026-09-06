import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantThemeChoice } from '@core/theme/tenant-theme-choice';

/**
 * Which theme does THIS tenant render with, and with which variable overrides?
 *
 * The theme half of what `PluginTenantAccess` is for plugins, and for the same reasons. Installation
 * stays platform-wide (`_system_themes`, one row per slug on disk); ACTIVATION is per tenant
 * (`_system_tenant_themes`, at most one active row per tenant). Putting a `tenant_id` on the platform
 * table would have repeated the `_system_meta` mistake from T1 — one row per slug means two tenants
 * could never both activate the same theme.
 *
 * READ SYNCHRONOUSLY, DELIBERATELY. `/system/frontend` is on every storefront request's path and is
 * the payload the server renderer derives its generation from; it cannot pay a database round-trip per
 * request. The tenant's choice is loaded once when the request's tenant is resolved (`warm`, from the
 * tenancy middleware) and read out of memory. Invalidated on every write, which is what makes
 * activating a theme take effect on the tenant's NEXT request — no restart, no push.
 *
 * Single-tenant deployments never reach this class: `ThemeManager` keeps its process-wide
 * `activeTheme` there, exactly as before tenancy existed.
 */
export class TenantThemeAccess {
  private static readonly logger = new Logger({ namespace: 'theme-tenancy' });

  /** tenantId -> the tenant's choice. A missing key means "never successfully loaded". */
  private static cache = new Map<string, TenantThemeChoice>();

  private static db: any;

  /** Wired once at boot by the theme manager, with the request-path connection. */
  static configure(db: unknown): void {
    TenantThemeAccess.db = db;
    TenantThemeAccess.cache = new Map();
  }

  /**
   * Loads a tenant's choice if it is not already in memory.
   *
   * A failed read does NOT populate the cache — one transient database error must not become a
   * permanent "this tenant has no theme" for the life of the process.
   */
  static async warm(tenantId: string): Promise<void> {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant || TenantThemeAccess.cache.has(tenant) || !TenantThemeAccess.db) return;

    try {
      const rows = await TenantThemeAccess.db.find(SystemConstants.TABLE.TENANT_THEMES, {
        where: { tenant_id: tenant },
      });
      TenantThemeAccess.cache.set(tenant, TenantThemeChoice.fromRows(rows ?? []));
    } catch (error: any) {
      TenantThemeAccess.logger.warn(
        `Could not read the active theme for tenant "${tenant}": ${error?.message || error}. `
        + 'The tenant renders with NO theme until a read succeeds.',
      );
    }
  }

  /**
   * The CURRENT request's tenant's choice.
   *
   *  - single-tenant deployment -> null, and callers fall back to the process-wide active theme.
   *  - a tenant is bound        -> its stored choice (possibly "no theme").
   *  - multi-tenant, no tenant  -> "no theme". A request that resolved no site must not be handed
   *                                some other site's theme; that is the fail-open shape closed
   *                                everywhere else in this program.
   */
  static currentChoice(): TenantThemeChoice | null {
    if (!TenantMode.isEnabled()) return null;
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) return TenantThemeChoice.none();
    return TenantThemeAccess.choiceFor(tenantId);
  }

  /** What is known about a named tenant right now. "No theme" when never loaded. */
  static choiceFor(tenantId: string): TenantThemeChoice {
    return TenantThemeAccess.cache.get(String(tenantId ?? '').trim()) ?? TenantThemeChoice.none();
  }

  /** For the admin, which reads on a named tenant's behalf. */
  static async choiceForAsync(tenantId: string): Promise<TenantThemeChoice> {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant) return TenantThemeChoice.none();
    await TenantThemeAccess.warm(tenant);
    return TenantThemeAccess.choiceFor(tenant);
  }

  /**
   * Forgets what it knows, so the next request re-reads. Called by every write path — this IS the
   * "no restart" mechanism for theme activation.
   */
  static invalidate(tenantId?: string): void {
    const tenant = String(tenantId ?? '').trim();
    if (tenant) {
      TenantThemeAccess.cache.delete(tenant);
      return;
    }
    TenantThemeAccess.cache.clear();
  }

  /** Test seam. */
  static reset(): void {
    TenantThemeAccess.cache = new Map();
    TenantThemeAccess.db = undefined;
  }
}
