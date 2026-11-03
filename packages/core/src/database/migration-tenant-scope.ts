import type { IDatabaseManager, IMigrationTenantScope } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * The runner's `IMigrationTenantScope`: runs a migration's callback once per site, with that site bound.
 *
 * A migration runs with no site bound, and every tenant-owned table is behind FORCE row-level security —
 * so without this a DATA migration's `find` returns no rows and its `update` matches none, and the run
 * is recorded as done having changed nothing. The site list is read here, by the framework, so a plugin
 * migration never touches the tenants table itself.
 *
 * Whether there are sites is read from the tenants table itself, not from `TenantMode`: core migrations
 * run at boot BEFORE `TenantMode` is configured, so asking it there always answered "single-tenant" and
 * the callback ran once, unbound, on a deployment with sites.
 *
 * Same binding `SchemaReconciliationService` uses for its per-site counts: the request context carries
 * the tenant for the proxy layer, `withTenant` holds a client with `app.tenant_id` set for the database.
 * A failure for one site propagates — the migration is then not recorded, and runs again next time.
 */
export class MigrationTenantScope implements IMigrationTenantScope {
  constructor(private readonly db: IDatabaseManager) {}

  async forEachTenant(fn: (tenantId: string) => Promise<void>): Promise<void> {
    const tenantIds = await this.tenantIds();
    if (tenantIds.length === 0) {
      await fn('');
      return;
    }
    for (const tenantId of tenantIds) {
      await RequestContextUtils.storage.run({ tenantId }, () => this.db.withTenant(tenantId, () => fn(tenantId)));
    }
  }

  /** The sites, or none when this driver has no isolation or the tenants table does not exist yet. */
  private async tenantIds(): Promise<string[]> {
    if (!this.db.supportsTenantIsolation()) return [];
    if (!(await this.db.tableExists(SystemConstants.TABLE.TENANTS))) return [];
    const rows = await this.db.withPlatformAdmin(() => this.db.find(SystemConstants.TABLE.TENANTS, { limit: 10000 }));
    return (rows || []).map((row: Record<string, unknown>) => String(row?.id ?? '')).filter(Boolean);
  }
}
