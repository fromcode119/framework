import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { Logger } from '@core/logging';
import type { PluginContext } from '@core/plugin/plugin-context';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { PluginSiteDataContext } from '@core/plugin/tenant/plugin-site-data-context';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * Runs a plugin's `onInit` again, once per site, so its DATA work actually happens.
 *
 * Only on a multi-site deployment. With one site the first pass already ran inside the only scope
 * there is, and replaying would do everything twice.
 *
 * A failure here never fails the plugin. The registration pass has already succeeded, so the plugin
 * works; what failed is one site's setup, and taking the whole plugin down for every site because
 * one site's data is bad is the wrong trade. It is logged against the site it belongs to.
 */
export class PluginSiteDataReplay {
  static async run(
    plugin: ILoadedPlugin,
    context: PluginContext,
    db: { withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> },
    logger: Logger,
  ): Promise<void> {
    if (!TenantMode.isEnabled() || !plugin.onInit) return;

    const slug = plugin.manifest.slug;
    const siteContext = PluginSiteDataContext.wrap(context);

    try {
      await PerTenantRun.forEach({
        label: `${slug}:site-data`,
        db,
        // Only sites that actually run this plugin. Without it the replay set up data for every
        // site on the deployment — it created a default contact form for eight sites that do not
        // have Forms enabled, which is worse than the bug it was fixing: the first left data
        // missing, this leaves data nobody asked for in somebody else's site.
        appliesTo: (tenantId) => PluginTenantAccess.isPresentFor(slug, tenantId),
        before: (tenantId) => PluginTenantAccess.warm(tenantId),
        work: async () => { await plugin.onInit!(siteContext); },
      });
    } catch (error: unknown) {
      logger.warn(`[${slug}] per-site setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
