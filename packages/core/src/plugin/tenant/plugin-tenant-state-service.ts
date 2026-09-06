import { CoercionUtils } from '@core/coercion-utils';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Turning a plugin on or off for one tenant.
 *
 * Framework-owned: `_system_tenant_plugins` is a system table read through the RAW manager, so
 * snake_case column names. No plugin reads or writes it — a plugin deciding which tenants run it
 * would be the whole trust boundary inverted.
 *
 * Every write invalidates the cache the gates read. That, plus the fact that the gates are consulted
 * per request, is the entire mechanism behind "takes effect without a restart": nothing is loaded,
 * unloaded, or re-registered, because enablement is CONFIGURATION and not code.
 *
 * What it deliberately does NOT do:
 *  - it does not create or drop tables. A plugin's tables are platform-wide schema and its rows are
 *    tenant-scoped, so enabling creates nothing and DISABLING DELETES NOTHING. The tenant's data
 *    stays and reappears intact if it is re-enabled. Disabling must never be a destructive action
 *    hiding behind an innocuous toggle; erasing a tenant's data is T4, where it is named as such.
 *  - it does not touch `_system_plugins`. Installation is platform-wide and stays there.
 */
export class PluginTenantStateService {
  private static readonly ACTIVE = 'active';
  private static readonly INACTIVE = 'inactive';

  constructor(private readonly db: any) {}

  /** Slugs this tenant runs. Ordered by nothing in particular — the caller presents them. */
  async listEnabled(tenantId: string): Promise<string[]> {
    const tenant = CoercionUtils.toString(tenantId).trim();
    if (!tenant) return [];

    const rows = await this.db.find(SystemConstants.TABLE.TENANT_PLUGINS, {
      where: { tenant_id: tenant },
    });
    return (rows ?? [])
      .filter((row: any) => String(row?.state ?? '') === PluginTenantStateService.ACTIVE)
      .map((row: any) => String(row?.plugin_slug ?? '').trim())
      .filter((slug: string) => slug.length > 0);
  }

  async enable(tenantId: string, slug: string): Promise<void> {
    await this.write(tenantId, slug, PluginTenantStateService.ACTIVE);
  }

  async disable(tenantId: string, slug: string): Promise<void> {
    await this.write(tenantId, slug, PluginTenantStateService.INACTIVE);
  }

  /**
   * Upsert by hand rather than by `ON CONFLICT`, because this runs through the manager rather than
   * raw SQL and has to work on every dialect the framework supports.
   */
  private async write(tenantId: string, slug: string, state: string): Promise<void> {
    const tenant = CoercionUtils.toString(tenantId).trim();
    const name = CoercionUtils.toString(slug).trim();
    if (!tenant || !name) {
      throw new Error('PluginTenantStateService: a tenant id and a plugin slug are both required.');
    }

    const existing = await this.db.findOne(SystemConstants.TABLE.TENANT_PLUGINS, {
      tenant_id: tenant, plugin_slug: name,
    });

    if (existing) {
      await this.db.update(
        SystemConstants.TABLE.TENANT_PLUGINS,
        { tenant_id: tenant, plugin_slug: name },
        { state, updated_at: new Date() },
      );
    } else {
      await this.db.insert(SystemConstants.TABLE.TENANT_PLUGINS, {
        tenant_id: tenant,
        plugin_slug: name,
        state,
        enabled_at: state === PluginTenantStateService.ACTIVE ? new Date() : null,
      });
    }

    // Last, and never skipped. Everything above is inert until the gates stop serving the old
    // answer; this line is the difference between "saved" and "in effect".
    PluginTenantAccess.invalidate(tenant);
  }
}
