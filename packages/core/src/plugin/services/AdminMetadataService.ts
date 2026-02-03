import { LoadedPlugin, Collection } from '../../types';
import { Logger } from '../../logging/logger';

export class AdminMetadataService {
  private logger = new Logger({ namespace: 'AdminMetadataService' });

  public getAdminMetadata(
    plugins: Map<string, LoadedPlugin>,
    registeredCollections: Map<string, { collection: Collection; pluginSlug: string }>,
    runtimeModules: any
  ) {
    const allPlugins = Array.from(plugins.values());
    
    const pluginMetadata = allPlugins
      .filter(p => p.state === 'active' && p.manifest.admin)
      .map(p => {
        const collections = Array.from(registeredCollections.values())
          .filter(c => c.pluginSlug === p.manifest.slug)
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
            headInjections: []
          }
        };
      });

    const rawMenuItems: any[] = [];

    // System Items
    rawMenuItems.push({ label: 'Themes', path: '/themes', icon: 'Palette', group: 'Platform', pluginSlug: 'system', priority: 90 });
    rawMenuItems.push({
      label: 'Users',
      path: '/users',
      icon: 'Users',
      group: 'Platform',
      pluginSlug: 'system',
      priority: 80,
      children: [
        { label: 'Roles', path: '/users/roles', icon: 'Shield' },
        { label: 'Permissions', path: '/users/permissions', icon: 'Lock' }
      ]
    });
    rawMenuItems.push({ label: 'Activity', path: '/activity', icon: 'Activity', group: 'Platform', pluginSlug: 'system', priority: 85 });

    // Plugin Items
    pluginMetadata.forEach(p => {
      if (p.admin?.menu) {
        p.admin.menu.forEach(item => {
          let effectivePath = item.path;

          if (effectivePath && !effectivePath.startsWith('/admin/') && !effectivePath.startsWith(`/${p.slug}/`)) {
            const pathSlug = effectivePath.replace(/^\//, '');
            const registeredForPlugin = Array.from(registeredCollections.values())
              .filter(c => c.pluginSlug === p.slug)
              .map(c => c.collection);

            const hasMatchingCollection = 
              p.admin.collections?.some(col => col.shortSlug === pathSlug || col.slug === pathSlug || (col as any).unprefixedSlug === pathSlug) ||
              registeredForPlugin.some(col => col.shortSlug === pathSlug || col.slug === pathSlug || col.unprefixedSlug === pathSlug);
            
            if (hasMatchingCollection) {
                effectivePath = `/${p.slug}/${pathSlug}`;
            }
          }

          rawMenuItems.push({
            ...item,
            path: effectivePath,
            pluginSlug: p.slug,
            group: item.group || p.admin.group || p.name
          });
        });
      }

      const collections = Array.from(registeredCollections.values())
        .filter(c => c.pluginSlug === p.slug)
        .map(c => c.collection);

      if (collections.length > 0) {
        collections.forEach(col => {
          if (col.admin?.hidden) return;
          if (col.slug === 'settings') return;
          
          const shortSlug = col.shortSlug || col.slug;
          const path = `/${p.slug}/${shortSlug}`;
          const label = col.name || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1);
          
          const isExplicitlyHandled = rawMenuItems.some(m => {
             if (m.pluginSlug !== p.slug) return false;
             if (m.path === path) return true;
             const normalizedPath = m.path?.toLowerCase().replace(/^\/[^/]+\//, '').replace(/^\//, '');
             if (normalizedPath === shortSlug) return true;
             return false;
          });

          if (!isExplicitlyHandled) {
            const isDuplicate = rawMenuItems.some(m => 
              m.path === path || 
              (m.label.toLowerCase() === label.toLowerCase() && m.pluginSlug === p.slug)
            );

            if (!isDuplicate) {
              rawMenuItems.push({
                label,
                path,
                icon: col.admin?.icon || p.admin.icon || 'FileText',
                group: col.admin?.group || p.admin.group || p.name,
                priority: col.priority || 100,
                pluginSlug: p.slug
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

    return {
      plugins: pluginMetadata,
      menu: finalMenu.sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      runtimeModules
    };
  }
}
