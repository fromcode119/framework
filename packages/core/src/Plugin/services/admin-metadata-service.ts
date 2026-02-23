import { LoadedPlugin, Collection } from '../../types';
import { Logger } from '@fromcode119/sdk';
import {
  normalizeMenuPath,
  getNestedMenuPaths,
  deduplicateMenuItems
} from '../../utils';
import {
  buildCollectionRouteKeySet,
  isCollectionMenuPath,
  expectedPageSlotFromPath
} from './admin-route-utils';

export class AdminMetadataService {
  private logger = new Logger({ namespace: 'admin-metadata-service' });

  public getAdminMetadata(
    allPlugins: LoadedPlugin[],
    registeredCollections: Map<string, { collection: Collection; pluginSlug: string }>,
    runtimeModules: any
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
            entryUrl: p.manifest.ui?.entry ? `/plugins/${p.manifest.slug}/ui/${p.manifest.ui.entry}` : undefined,
            cssUrls: p.manifest.ui?.css ? p.manifest.ui.css.map(css => `/plugins/${p.manifest.slug}/ui/${css}`) : [],
            headInjections: []
          }
        };
      });

    const rawMenuItems: any[] = [];

    // System Items
    rawMenuItems.push({ label: 'Dashboard', path: '/', icon: 'Dashboard', group: 'Core', pluginSlug: 'system', priority: 10 });
    rawMenuItems.push({
      label: 'Users',
      path: '/users',
      icon: 'Users',
      group: 'Platform',
      pluginSlug: 'system',
      priority: 11,
      isGroup: true,
      children: [
        { label: 'Users List', path: '/users', icon: 'Users' },
        { label: 'Roles', path: '/users/roles', icon: 'Shield' },
        { label: 'Permissions', path: '/users/permissions', icon: 'Lock' }
      ]
    });
    rawMenuItems.push({ label: 'Plugins', path: '/plugins', icon: 'Package', group: 'Management', pluginSlug: 'system', priority: 20 });
    rawMenuItems.push({ label: 'Media', path: '/media', icon: 'Image', group: 'Core', pluginSlug: 'system', priority: 30 });
    rawMenuItems.push({ label: 'Themes', path: '/themes', icon: 'Palette', group: 'Platform', pluginSlug: 'system', priority: 90 });
    rawMenuItems.push({ label: 'Activity', path: '/activity', icon: 'Activity', group: 'Platform', pluginSlug: 'system', priority: 85 });

    // Plugin Items
    pluginMetadata.forEach(p => {
      const slug = p.slug.toLowerCase();
      const pluginCollections = Array.from(registeredCollections.values())
        .filter(c => String(c.pluginSlug).toLowerCase() === slug)
        .map(c => c.collection);
      const collectionRouteKeys = buildCollectionRouteKeySet([
        ...(p.admin?.collections || []),
        ...pluginCollections
      ]);
      const declaredSlots = new Set<string>(
        ((p.admin?.slots || []) as Array<{ slot?: string }>)
          .map((slotDef) => String(slotDef?.slot || '').trim())
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
          if (effectivePath && effectivePath.startsWith(`/${slug}`) && !isCollectionMenuPath(effectivePath, slug, collectionRouteKeys)) {
            const expectedSlot = expectedPageSlotFromPath(effectivePath, slug);
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
          
          const label = col.name || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1);
          
          const isExplicitlyHandled = rawMenuItems.some(m => {
             if (m.pluginSlug !== slug) return false;
             const candidatePaths = getNestedMenuPaths(m);
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

      if (strategy === 'section') {
        items.forEach(item => {
          finalMenu.push({
            ...item,
            group: groupName
          });
        });
      } else {
        const groupIcon = items.find(i => i.icon)?.icon || plugin?.manifest.admin?.icon || 'Layers';
        
        finalMenu.push({
          label: groupName,
          icon: groupIcon,
          group: groupName,
          path: `/#group-${pluginSlug}-${groupName.toLowerCase()}`,
          children: items,
          isGroup: true,
          priority: items[0].priority || 50,
          pluginSlug
        });
      }
    });

    const sorted = finalMenu.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const dedupedMenu = deduplicateMenuItems(sorted);

    return {
      plugins: pluginMetadata,
      menu: dedupedMenu,
      runtimeModules
    };
  }
}
