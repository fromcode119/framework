import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginConfigValueService } from '@core/plugin/services/settings/plugin-config-value-service';

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

  /**
   * A contract gated by one of its plugin's settings (`enabledBySetting`) materializes only where the
   * scope's STORED value of that setting is `true`. Read from the scope's own settings row (row-level
   * security selects the site's), so a site that never turned the feature on gets no page for it.
   */
  async contractsEnabledBySettings(contracts: IResolvedPluginDefaultPageContract[]): Promise<IResolvedPluginDefaultPageContract[]> {
    const settingsByPlugin = new Map<string, Record<string, any>>();
    const kept: IResolvedPluginDefaultPageContract[] = [];
    for (const contract of contracts) {
      const setting = contract.enabledBySetting;
      if (!setting) {
        kept.push(contract);
        continue;
      }
      if (!settingsByPlugin.has(contract.pluginSlug)) {
        const row = await this.db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: contract.pluginSlug });
        settingsByPlugin.set(contract.pluginSlug, PluginConfigValueService.getSettings(row?.settings));
      }
      if (settingsByPlugin.get(contract.pluginSlug)?.[setting] === true) kept.push(contract);
    }
    return kept;
  }
}
