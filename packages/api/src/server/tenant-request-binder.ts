import { PluginTenantAccess, RequestContextUtils, TenantThemeAccess } from '@fromcode119/core';
import type { TenantRecord } from '@fromcode119/core';

/**
 * The one way a request becomes tenant-bound, shared by every resolver (host, admin session, api key).
 *
 * Publishes the tenant on the async request context and holds the tenant-bound connection scope until
 * the response is finished, so every statement the request issues — plugin code and raw SQL included —
 * runs under that tenant's policy. The tenant's plugin and theme sets are warmed FIRST and awaited, so
 * the synchronous gates on routes, hooks and the namespace API can answer for it; they fail closed,
 * and a request that overtook the load would be refused for a plugin the tenant does run.
 */
export class TenantRequestBinder {
  constructor(
    private readonly db: { withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> },
    private readonly logger: { error(message: string, error?: unknown): void },
  ) {}

  async bind(req: any, res: any, locale: string, tenant: TenantRecord, next: () => void, surface: string): Promise<void> {
    req.tenantId = tenant.id;
    await Promise.all([PluginTenantAccess.warm(tenant.id), TenantThemeAccess.warm(tenant.id)]);
    RequestContextUtils.storage.run({ locale, tenantId: tenant.id }, () => {
      this.db.withTenant(tenant.id, () => new Promise<void>((resolve) => {
        res.on('finish', resolve);
        res.on('close', resolve);
        next();
      })).catch((error: unknown) => {
        this.logger.error(`Tenant-scoped ${surface} request failed for tenant "${tenant.id}"`, error);
      });
    });
  }
}
