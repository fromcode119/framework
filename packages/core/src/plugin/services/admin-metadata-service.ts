import fs from 'fs';
import path from 'path';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { ICollection } from '@core/interfaces/collection.interface';
import { Logger } from '@core/logging';

import { SystemConstants } from '@core/constants/system.constants';
import { ApiPathUtils } from '@core/api/api-path-utils';
import type { IAdminSecondaryPanelAllowlistEntry } from '@core/plugin/services/interfaces/admin-secondary-panel-allowlist-entry.interface';
import type { IAdminSecondaryPanelInputItem } from '@core/plugin/services/interfaces/admin-secondary-panel-input-item.interface';
import type { IAdminSecondaryPanelNormalizedItem } from '@core/plugin/services/interfaces/admin-secondary-panel-normalized-item.interface';
import type { IAdminSecondaryPanelRejection } from '@core/plugin/services/interfaces/admin-secondary-panel-rejection.interface';
import { AdminSecondaryPanelNormalizer } from '@core/plugin/services/admin-secondary-panel-normalizer';
import { AdminSecondaryPanelGuard } from '@core/plugin/services/admin-secondary-panel-guard';
import { AdminSecondaryPanelGovernanceService } from '@core/plugin/services/admin-secondary-panel-governance-service';
import { AdminSecondaryPanelPrecedenceService } from '@core/plugin/services/admin-secondary-panel-precedence-service';
import { AdminSecondaryPanelResolver } from '@core/plugin/services/admin-secondary-panel-resolver';
import { AdminSystemNavigationMetadataService } from '@core/plugin/services/admin-system-navigation-metadata-service';
import { AdminMenuBuilderService } from '@core/plugin/services/admin-menu-builder-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class AdminMetadataService {
  private logger = new Logger({ namespace: 'admin-metadata-service' });
  private secondaryPanelNormalizer = new AdminSecondaryPanelNormalizer();
  private secondaryPanelGuard = new AdminSecondaryPanelGuard();
  private secondaryPanelGovernance = new AdminSecondaryPanelGovernanceService();
  private secondaryPanelPrecedence = new AdminSecondaryPanelPrecedenceService();
  private secondaryPanelResolver = new AdminSecondaryPanelResolver();
  private systemNavigationMetadata = new AdminSystemNavigationMetadataService();
  private menuBuilder = new AdminMenuBuilderService(this.logger, this.systemNavigationMetadata);

  public getAdminMetadata(
    allPlugins: ILoadedPlugin[],
    registeredCollections: Map<string, { collection: ICollection; pluginSlug: string }>,
    runtimeModules: any,
    allowlistEntries: IAdminSecondaryPanelAllowlistEntry[] = []
  ) {
    // NOTE: `p.manifest.config` (the plugin's SAVED settings, hydrated from the DB by
    // lifecycle-service) is deliberately NOT included. This payload is served by a route guarded with
    // `auth.guard()` — any authenticated user, a storefront customer included — and nothing in the
    // admin ever read it, so every plugin's settings VALUES (e.g. the broadcasts `tokenSecret`) were
    // shipped to every logged-in visitor for no reader at all. Plugin settings have their own
    // admin-guarded endpoint (`/plugins/:slug/settings`); that is where they belong.
    const pluginMetadata = allPlugins
      .filter(p => p.state === PluginState.ACTIVE && p.manifest.admin)
      .map(p => {
        const collections = Array.from(registeredCollections.values())
          .filter(c => String(c.pluginSlug).toLowerCase() === String(p.manifest.slug).toLowerCase())
          .map(c => ({
             ...c.collection,
             pluginSlug: p.manifest.slug,
             unprefixedSlug: (c.collection as any).unprefixedSlug || c.collection.slug
          }));

        return {
          slug: p.manifest.slug,
          name: p.manifest.name,
          admin: {
            ...p.manifest.admin,
            collections
          },
          ui: {
            ...(p.manifest.ui || {}),
            entryUrl: p.manifest.ui?.entry ? this.pluginUiAssetPath(p, p.manifest.ui.entry) : undefined,
            cssUrls: p.manifest.ui?.css ? p.manifest.ui.css.map(css => this.pluginUiAssetPath(p, css)) : [],
            headInjections: []
          }
        };
      });

    const dedupedMenu = this.menuBuilder.build(allPlugins, pluginMetadata, registeredCollections);

    const secondaryPanel = this.buildSecondaryPanel(allPlugins, allowlistEntries);

    return {
      plugins: pluginMetadata,
      menu: dedupedMenu,
      secondaryPanel,
      runtimeModules
    };
  }

  private buildSecondaryPanel(allPlugins: ILoadedPlugin[], allowlistEntries: IAdminSecondaryPanelAllowlistEntry[]) {
    const normalizedItems = [
      ...this.systemNavigationMetadata.getSecondaryPanelInputs(),
      ...allPlugins
        .filter(plugin => plugin.state === PluginState.ACTIVE)
        .flatMap((plugin) => this.getSecondaryPanelInputs(plugin)),
    ]
      .map((input) => this.secondaryPanelNormalizer.normalize(input));

    const accepted: IAdminSecondaryPanelNormalizedItem[] = [];
    for (const item of normalizedItems) {
      const guardRejection = this.secondaryPanelGuard.validate(item);
      if (guardRejection) {
        this.logSecondaryPanelRejection(guardRejection);
        continue;
      }
      const governanceRejection = this.secondaryPanelGovernance.isAllowed(item, allowlistEntries);
      if (governanceRejection) {
        this.logSecondaryPanelRejection(governanceRejection);
        continue;
      }
      accepted.push(item);
    }
    return this.secondaryPanelResolver.resolve(this.secondaryPanelPrecedence.apply(accepted), allowlistEntries.length);
  }

  private getSecondaryPanelInputs(plugin: ILoadedPlugin): IAdminSecondaryPanelInputItem[] {
    const sourceNamespace = String(plugin.manifest.namespace || '').trim().toLowerCase();
    const sourcePlugin = String(plugin.manifest.slug || '').trim().toLowerCase();
    const sourceCanonicalKey = `${sourceNamespace}:${sourcePlugin}`;
    const items = plugin.manifest.admin?.secondaryPanel?.items || [];
    return items.map((item) => ({ sourceNamespace, sourcePlugin, sourceCanonicalKey, item }));
  }

  private logSecondaryPanelRejection(rejection: IAdminSecondaryPanelRejection): void {
    this.logger.warn(`[admin-secondary-panel] REJECTED ${JSON.stringify(rejection)}`);
  }

  private pluginUiAssetPath(plugin: ILoadedPlugin, asset: string): string {
    const basePath = ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.UI, { slug: plugin.manifest.slug }).replace('*', asset.replace(/^\/+/, ''));
    const assetVersion = this.resolvePluginUiAssetVersion(plugin, asset);
    if (!assetVersion) {
      return basePath;
    }

    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}v=${assetVersion}`;
  }

  private resolvePluginUiAssetVersion(plugin: ILoadedPlugin, asset: string): string | null {
    const pluginPath = String(plugin.path || '').trim();
    if (!pluginPath) {
      return null;
    }

    const absolutePath = path.resolve(pluginPath, 'src', 'ui', asset.replace(/^\/+/, ''));
    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    try {
      return String(Math.trunc(fs.statSync(absolutePath).mtimeMs));
    } catch {
      return null;
    }
  }
}
