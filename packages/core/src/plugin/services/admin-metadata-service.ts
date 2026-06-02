import fs from 'fs';
import path from 'path';
import { LoadedPlugin, Collection } from '../../types';
import { Logger } from '../../logging';
import { CoreServices } from '../../services';
import { AdminRouteUtils } from './admin-route-utils';
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

export class AdminMetadataService {
  private logger = new Logger({ namespace: 'admin-metadata-service' });
  private secondaryPanelNormalizer = new AdminSecondaryPanelNormalizer();
  private secondaryPanelGuard = new AdminSecondaryPanelGuard();
  private secondaryPanelGovernance = new AdminSecondaryPanelGovernanceService();
  private secondaryPanelPrecedence = new AdminSecondaryPanelPrecedenceService();
  private secondaryPanelResolver = new AdminSecondaryPanelResolver();
  private systemNavigationMetadata = new AdminSystemNavigationMetadataService();

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

    const rawMenuItems: any[] = this.systemNavigationMetadata
      .getMenuItems()
      .map((item) => ({
        ...item,
        pluginSlug: 'system',
      }));

    // Plugin Items
    pluginMetadata.forEach(p => {
      const slug = p.slug.toLowerCase();
      const pluginCollections = Array.from(registeredCollections.values())
        .filter(c => String(c.pluginSlug).toLowerCase() === slug)
        .map(c => c.collection);
      const collectionRouteKeys = AdminRouteUtils.buildCollectionRouteKeySet([
        ...(p.admin?.collections || []),
        ...pluginCollections
      ]);
      const declaredSlots = new Set<string>(
        ((p.admin?.slots || []) as Array<{ slot?: string }>)
          .map((slotDef) => String(slotDef?.slot || '').trim())
          .filter(Boolean)
      );
      const secondaryPanelPaths = new Set<string>(
        ((p.admin?.secondaryPanel?.items || []) as Array<{ path?: string }>)
          .map((item) => String(item?.path || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const contentSlot = `admin.plugin.${slug}.content`;

      if (p.admin?.menu) {
        p.admin.menu.forEach(item => {
          let effectivePath = item.path;

          if (effectivePath && !effectivePath.startsWith('/admin/') && !effectivePath.startsWith(`/${slug}/`)) {
            const pathSlug = effectivePath.replace(/^\//, '');
            const registeredForPlugin = pluginCollections;

            const hasMatchingCollection = 
              p.admin.collections?.some(col => col.shortSlug === pathSlug || col.slug === pathSlug || (col as any).unprefixedSlug === pathSlug) ||
              registeredForPlugin.some(col => col.shortSlug === pathSlug || col.slug === pathSlug || col.unprefixedSlug === pathSlug);
            
            if (hasMatchingCollection) {
                effectivePath = `/${slug}/${pathSlug}`;
            }
          }

          // Validate plugin page routes early so broken paths never reach runtime.
          if (effectivePath && effectivePath.startsWith(`/${slug}`) && !AdminRouteUtils.isCollectionMenuPath(effectivePath, slug, collectionRouteKeys)) {
            const expectedSlot = AdminRouteUtils.expectedPageSlotFromPath(effectivePath, slug);
            const hasExpectedSlot = expectedSlot ? declaredSlots.has(expectedSlot) : false;
            const hasContentFallback = declaredSlots.has(contentSlot);
            if (!hasExpectedSlot && !hasContentFallback) {
              this.logger.warn(
                `[admin-metadata] Skipping menu item "${item.label}" for plugin "${slug}" at "${effectivePath}" because no UI slot is declared. Expected "${expectedSlot}", or fallback "${contentSlot}".`
              );
              return;
            }
          }

          rawMenuItems.push({
            ...item,
            path: effectivePath,
            pluginSlug: slug,
            group: item.group || p.admin.group || p.name
          });
        });
      }

      const collections = pluginCollections;

      if (collections.length > 0) {
        collections.forEach(col => {
          if (col.admin?.hidden) return;
          if (col.slug === 'settings') return;
          
          const shortSlug = (col.shortSlug || col.slug).toLowerCase();
          
          let path = `/${slug}/${shortSlug}`;
          
          // Shorter URL for primary collections (e.g. /forms instead of /forms/forms)
          if (shortSlug === slug) {
              path = `/${slug}`;
          }

          if (secondaryPanelPaths.has(path.toLowerCase())) {
            return;
          }
          
          const label = col.displayName || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1);
          
          const isExplicitlyHandled = rawMenuItems.some(m => {
             if (m.pluginSlug !== slug) return false;
             const candidatePaths = CoreServices.getInstance().menu.getNestedPaths(m);
             return candidatePaths.some((candidatePath) => {
               if (candidatePath === path) return true;
               const normalizedPath = candidatePath?.toLowerCase().replace(/^\/[^/]+\//, '').replace(/^\//, '');
               if (normalizedPath === shortSlug) return true;
               // Also check the root path if it's a primary collection
               if (shortSlug === slug && candidatePath === `/${slug}`) return true;
               return false;
             });
          });

          if (!isExplicitlyHandled) {
            const isDuplicate = rawMenuItems.some(m => 
              m.path === path || 
              (m.label.toLowerCase() === label.toLowerCase() && m.pluginSlug === slug)
            );

            if (!isDuplicate) {
              rawMenuItems.push({
                label,
                path,
                icon: col.admin?.icon || p.admin.icon || 'FileText',
                group: col.admin?.group || p.admin.group || p.name,
                priority: col.admin?.priority || col.priority || 100,
                pluginSlug: slug
              });
            }
          }
        });
      }
    });

    const finalMenu: any[] = [];
    const pluginGroupBuckets: Record<string, { pluginSlug: string, groupName: string, items: any[] }> = {};

    rawMenuItems.forEach(item => {
      const gName = item.group || 'Platform';
      const bucketKey = `${item.pluginSlug}:${gName}`;
      if (!pluginGroupBuckets[bucketKey]) {
        pluginGroupBuckets[bucketKey] = { 
            pluginSlug: item.pluginSlug || 'system', 
            groupName: gName, 
            items: [] 
        };
      }
      pluginGroupBuckets[bucketKey].items.push(item);
    });

    Object.values(pluginGroupBuckets).forEach(bucket => {
      const { pluginSlug, groupName, items } = bucket;
      const plugin = allPlugins.find(p => p.manifest.slug === pluginSlug);
      
      let strategy: 'dropdown' | 'section' = 'section';
      
      if (plugin?.manifest.admin?.groupStrategy) {
        const gs = plugin.manifest.admin.groupStrategy as any;
        if (typeof gs === 'string') {
          strategy = gs as 'dropdown' | 'section';
        } else if (gs[groupName]) {
          strategy = gs[groupName] as 'dropdown' | 'section';
        }
      }

      // A dropdown wrapper only makes sense with 2+ children. A single-page plugin
      // (e.g. SEO → Overview, Analytics → Overview) should be a plain link with no
      // chevron — otherwise every plugin shows a redundant expand arrow.
      if (strategy === 'section' || items.length <= 1) {
        items.forEach(item => {
          finalMenu.push({
            ...item,
            group: groupName,
            // Single-page dropdown plugins still want the plugin's short label/icon
            // on their one nav item rather than the raw page label.
            ...(strategy !== 'section' && items.length === 1
              ? {
                  label: String(plugin?.manifest.admin?.label || item.label).trim(),
                  icon: plugin?.manifest.admin?.icon || item.icon,
                }
              : {}),
          });
        });
      } else {
        // Use admin.label (short display name, e.g. "CMS", "SEO") so that multiple
        // plugins sharing the same group each appear as a distinctly-named dropdown.
        // Fall back to manifest.name then groupName.
        const dropdownLabel = String(
          plugin?.manifest.admin?.label ||
          plugin?.manifest.name ||
          groupName
        ).trim();
        const groupIcon = plugin?.manifest.admin?.icon || items.find(i => i.icon)?.icon || 'Layers';
        // Anchor the dropdown to its first child's real path (e.g. /cms) so the
        // secondary-sidebar resolver can preview that plugin's panel on hover.
        // Falls back to a synthetic group anchor when no concrete path exists.
        const anchorPath = String(items[0]?.path || '').trim() || `/#group-${pluginSlug}-${groupName.toLowerCase()}`;

        finalMenu.push({
          label: dropdownLabel,
          icon: groupIcon,
          group: groupName,
          path: anchorPath,
          children: items,
          isGroup: true,
          priority: items[0].priority || 50,
          pluginSlug
        });
      }
    });

    const sorted = finalMenu.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const dedupedMenu = CoreServices.getInstance().menu.deduplicate(sorted);

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
