import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * What the SITE a materialization pass runs in allows. Outside a site (the single-site deployment's
 * boot pass) everything applies, exactly as before.
 */
export class PluginDefaultPageMaterializationSiteScope {
  constructor(private readonly db: any) {}

  /**
   * A workspace has no storefront (`TenantKind`): every path on its domain is the console. Its default
   * pages could never be reached, yet every boot and plugin activation published them there —
   * `/shop`, `/cookies-policy`, `/privacy-policy` sat as live, empty pages in three workspaces, and
   * re-appeared after being removed.
   */
  async isWorkspace(): Promise<boolean> {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) return false;
    const tenant = await TenantResolverService.shared(this.db).resolveById(tenantId);
    return Boolean(tenant?.isWorkspace);
  }

  /**
   * Inside a site only the contracts of plugins that site runs materialize: a site without a plugin
   * must not receive that plugin's pages.
   */
  static contractsForCurrentSite(contracts: IResolvedPluginDefaultPageContract[]): IResolvedPluginDefaultPageContract[] {
    if (!RequestContextUtils.getTenantId()) return contracts;
    return contracts.filter((contract) => PluginTenantAccess.isEnabledForCurrentTenant(contract.pluginSlug));
  }
}
