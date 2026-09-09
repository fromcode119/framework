import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * The CURRENT tenant's core integration instances, readable SYNCHRONOUSLY.
 *
 * Same shape and same reason as {@link PluginTenantAccess}: some seams cannot await. `MediaManager`
 * has `publicUrl(path)` returning a string and `QueueManager` has `applySettings`/`registerWorker`
 * returning nothing — every caller is synchronous, and turning them into promises would break the
 * plugin API. So the tenant's instances are resolved ONCE when the request's tenant is bound (`warm`,
 * from the tenancy middleware) and the synchronous methods read them out of memory.
 *
 * Until this existed, only `email` was tenant-routed: `storage`, `cache` and `queue` were assigned the
 * platform instance straight to the field, so every site shared one media manager, one cache and one
 * queue. For storage that is uploads and deletes, not merely URLs — a site with its own bucket would
 * have written into the platform's with nothing reporting it.
 *
 * A cold read is NOT silently answered with the platform's instance and forgotten: it is logged, because
 * "no tenant instance" during a tenant-bound request means the warm did not run, and the value returned
 * is then somebody else's.
 */
export class IntegrationTenantAccess {
  private static readonly logger = new Logger({ namespace: 'integration-tenancy' });

  /** `tenantId::type` -> resolved instance. A missing key means "never successfully loaded". */
  private static cache = new Map<string, unknown>();

  /** Resolves one tenant's instance of a type. Wired once at boot by the integration manager. */
  private static resolver: ((tenantId: string, type: string) => Promise<unknown>) | undefined;

  /** The core types warmed for every tenant-bound request. */
  static readonly WARMED_TYPES: readonly string[] = ['email', 'storage', 'cache', 'queue'];

  static configure(resolver: (tenantId: string, type: string) => Promise<unknown>): void {
    IntegrationTenantAccess.resolver = resolver;
    IntegrationTenantAccess.cache = new Map();
  }

  private static key(tenantId: string, type: string): string {
    return `${String(tenantId ?? '').trim()}::${String(type ?? '').trim()}`;
  }

  /**
   * Loads a tenant's core integrations if they are not already in memory.
   *
   * A failed read does NOT populate the cache: caching a failure would make one transient database
   * error look like a permanent configuration for as long as the process lives.
   */
  static async warm(tenantId: string): Promise<void> {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant || !IntegrationTenantAccess.resolver) return;
    await Promise.all(IntegrationTenantAccess.WARMED_TYPES.map(async (type) => {
      const key = IntegrationTenantAccess.key(tenant, type);
      if (IntegrationTenantAccess.cache.has(key)) return;
      try {
        const instance = await IntegrationTenantAccess.resolver!(tenant, type);
        IntegrationTenantAccess.cache.set(key, instance);
        // Which instance a site actually got. Debug-level because it is one line per type per site per
        // process, and it is the only way to see that per-site routing is doing anything at all — the
        // symptom of it silently not working is a correct-looking page serving another site's URLs.
        IntegrationTenantAccess.logger.debug(
          `Warmed "${type}" for site "${tenant}"${IntegrationTenantAccess.describe(type, instance)}`,
        );
      } catch (error: unknown) {
        IntegrationTenantAccess.logger.warn(
          `Could not resolve "${type}" for site "${tenant}": ${error instanceof Error ? error.message : String(error)}. `
          + 'Its synchronous methods will answer from the platform instance until a read succeeds.',
        );
      }
    }));
  }

  /** A short, safe fingerprint of a resolved instance — never its credentials. */
  private static describe(type: string, instance: unknown): string {
    if (type !== 'storage') return '';
    const publicUrl = (instance as { publicUrl?: (p: string) => string })?.publicUrl;
    if (typeof publicUrl !== 'function') return '';
    try {
      return ` (public base: ${publicUrl.call(instance, 'probe')})`;
    } catch {
      return '';
    }
  }

  /**
   * The current tenant's instance of a type, or `undefined` when there is no tenant bound (framework
   * work) or nothing warmed for it.
   */
  static forCurrentTenant<T>(type: string): T | undefined {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) return undefined;
    const found = IntegrationTenantAccess.cache.get(IntegrationTenantAccess.key(tenantId, type)) as T | undefined;
    if (!found) {
      IntegrationTenantAccess.logger.warn(
        `Site "${tenantId}" asked for "${type}" synchronously before it was warmed; answering from the `
        + 'PLATFORM instance. The tenancy middleware warms these when it binds the request, so this means '
        + 'a code path reached a synchronous integration method outside a bound request.',
      );
    }
    return found;
  }

  /** Forgets what it knows, so the next request re-reads. Every write path calls this. */
  static invalidate(tenantId?: string): void {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant) { IntegrationTenantAccess.cache.clear(); return; }
    for (const key of [...IntegrationTenantAccess.cache.keys()]) {
      if (key.startsWith(`${tenant}::`)) IntegrationTenantAccess.cache.delete(key);
    }
  }

  /** Test seam. */
  static reset(): void {
    IntegrationTenantAccess.cache = new Map();
    IntegrationTenantAccess.resolver = undefined;
  }
}
