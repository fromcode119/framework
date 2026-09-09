import { TenantMode } from '@core/tenant/tenant-mode';
import { RequestContextUtils } from '@core/context/request-context';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

import { PluginCollectionActivationService } from '@core/plugin/services/plugin-collection-activation-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/**
 * Running a site's seeds once its plugins are active, and the final pass that materializes the default
 * pages they declare.
 *
 * Split out of LifecycleService (429 lines) 2026-09-09.
 */
export class PluginSeedRunner {
  constructor(
    private readonly manager: IPluginManagerInterface,
    private readonly activation: PluginCollectionActivationService,
  ) {}

  /**
   * Final default-page materialization pass, run by the discovery coordinator once EVERY plugin in the boot
   * set is registered. The per-plugin pass inside {@link register} can execute before the plugin that owns the
   * `pages` collection is registered — it then skips ("no registered page collection available") and
   * required contract pages never materialize. This pass guarantees the pages collection is present.
   */
  /**
   * Runs every ACTIVE plugin's seed for the site currently in scope.
   *
   * Plugin seeds are skipped at boot on a multi-tenant platform because boot has no site (see
   * `runSeeds`). This is the per-site pass: called inside a tenant scope, so the same writes that were
   * refused by row-level security at boot succeed for the site that actually wants them.
   */
  public async runSeedsForCurrentSite(): Promise<string[]> {
    const seeded: string[] = [];
    for (const [slug, plugin] of this.manager.plugins) {
      if (plugin.state !== PluginState.ACTIVE || !plugin.manifest?.seeds) continue;
      await this.activation.runSeeds(slug);
      seeded.push(slug);
    }
    return seeded;
  }


  public async materializeDefaultPagesFinalPass(): Promise<void> {
    // On a multi-site platform pages belong to a SITE: the untenanted boot pass could only ever be
    // refused by row security (six "materialization failed" warnings per boot). Sites get their pages
    // when created (`TenantAdminService.materializePages`), inside their own tenant scope.
    if (TenantMode.isEnabled() && !RequestContextUtils.getTenantId()) return;
    await this.activation.materializeDefaultPages();
  }
}
