import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

/**
 * `context.tenants.forEach` — a plugin's work, once per site THAT HAS THE PLUGIN.
 *
 * It ran in every active site, including sites that never enabled the plugin: their request scope,
 * their bound connection, their data, reachable by a plugin those sites had switched off. The
 * scheduler and the per-site boot replay already filter on `PluginTenantAccess.isPresentFor`; this
 * now does too, for in-process and isolated plugins alike.
 *
 * Inside a request it runs once, for that request's site (if the plugin is on there), as its contract
 * always said — never fanning out from one site's request into every other's.
 */
export class PluginSitesForEach {
  static async run(slug: string, db: unknown, label: string, work: () => Promise<void>): Promise<number> {
    const current = TenantMode.isEnabled() ? String(RequestContextUtils.getTenantId() ?? '').trim() : '';
    if (current) {
      if (!(await PluginTenantAccess.isPresentFor(slug, current))) return 0;
      await work();
      return 1;
    }
    return PerTenantRun.forEach({
      label,
      db: db as never,
      work,
      appliesTo: (tenantId) => PluginTenantAccess.isPresentFor(slug, tenantId),
    });
  }
}
