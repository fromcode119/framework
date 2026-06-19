import fs from 'fs';
import path from 'path';
import { LoadedPlugin, Collection } from '../../types';
import { Logger } from '../../logging';
import { AppPathConstants } from '../../app-path-constants';
import { SystemConstants } from '../../constants';
import { ApiPathUtils } from '../../api/api-path-utils';
import { AdminSecondaryPanelAllowlistEntry, AdminSecondaryPanelInputItem, AdminSecondaryPanelNormalizedItem, AdminSecondaryPanelRejection } from './admin-secondary-panel.interfaces';
import { AdminSecondaryPanelNormalizer } from './admin-secondary-panel-normalizer';
import { AdminSecondaryPanelGuard } from './admin-secondary-panel-guard';
import { AdminSecondaryPanelGovernanceService } from './admin-secondary-panel-governance-service';
import { AdminSecondaryPanelPrecedenceService } from './admin-secondary-panel-precedence-service';
import { AdminSecondaryPanelResolver } from './admin-secondary-panel-resolver';
import { AdminSystemNavigationMetadataService } from './admin-system-navigation-metadata-service';
import { AdminMenuBuilderService } from './admin-menu-builder-service';

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
    allPlugins: LoadedPlugin[],
    registeredCollections: Map<string, { collection: Collection; pluginSlug: string }>,
    runtimeModules: any,
    allowlistEntries: AdminSecondaryPanelAllowlistEntry[] = []
  ) {
    const pluginMetadata = allPlugins
      .filter(p => p.state === 'active' && p.manifest.admin)
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
          config: p.manifest.config || {},
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

  private buildSecondaryPanel(allPlugins: LoadedPlugin[], allowlistEntries: AdminSecondaryPanelAllowlistEntry[]) {
    const normalizedItems = [
      ...this.systemNavigationMetadata.getSecondaryPanelInputs(),
      ...allPlugins
        .filter(plugin => plugin.state === 'active')
        .flatMap((plugin) => this.getSecondaryPanelInputs(plugin)),
    ]
      .map((input) => this.secondaryPanelNormalizer.normalize(input));

    const accepted: AdminSecondaryPanelNormalizedItem[] = [];
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

  private getSecondaryPanelInputs(plugin: LoadedPlugin): AdminSecondaryPanelInputItem[] {
    const sourceNamespace = String(plugin.manifest.namespace || '').trim().toLowerCase();
    const sourcePlugin = String(plugin.manifest.slug || '').trim().toLowerCase();
    const sourceCanonicalKey = `${sourceNamespace}:${sourcePlugin}`;
    const items = plugin.manifest.admin?.secondaryPanel?.items || [];
    return items.map((item) => ({ sourceNamespace, sourcePlugin, sourceCanonicalKey, item }));
  }

  private logSecondaryPanelRejection(rejection: AdminSecondaryPanelRejection): void {
    this.logger.warn(`[admin-secondary-panel] REJECTED ${JSON.stringify(rejection)}`);
  }

  private pluginUiAssetPath(plugin: LoadedPlugin, asset: string): string {
    const basePath = ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.UI, { slug: plugin.manifest.slug }).replace('*', asset.replace(/^\/+/, ''));
    const assetVersion = this.resolvePluginUiAssetVersion(plugin, asset);
    if (!assetVersion) {
      return basePath;
    }

    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}v=${assetVersion}`;
  }

  private resolvePluginUiAssetVersion(plugin: LoadedPlugin, asset: string): string | null {
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
