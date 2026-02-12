import { Request, Response, NextFunction } from 'express';
import { PluginManager } from '@fromcode/core';

export const createCollectionMiddleware = (manager: PluginManager) => {
  return (req: any, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    
    if (!slug) {
      return res.status(400).json({ error: 'Collection slug is required' });
    }

    // First try: Exact match (usually the full prefixed slug)
    let collectionEntry = manager.getCollection(slug);
    
    // Second try: Case-insensitive search through all collections by slug or shortSlug
    if (!collectionEntry) {
      const registeredCollections = (manager as any).registeredCollections as Map<string, any>;
      const targetSlug = slug.toLowerCase();
      
      const allEntries = Array.from(registeredCollections.entries());

      for (const [key, entry] of allEntries) {
        const collectionSlug = entry.collection.slug?.toLowerCase();
        const shortSlug = entry.collection.shortSlug?.toLowerCase();
        const unprefixedSlug = entry.collection.unprefixedSlug?.toLowerCase();
        
        const hasSuffixMatch = (value?: string) => {
          if (!value) return false;
          return (
            value.endsWith(`_${targetSlug}`) ||
            value.endsWith(`/${targetSlug}`) ||
            value.endsWith(`-${targetSlug}`)
          );
        };

        if (
          key.toLowerCase() === targetSlug || 
          collectionSlug === targetSlug || 
          shortSlug === targetSlug ||
          unprefixedSlug === targetSlug ||
          hasSuffixMatch(key.toLowerCase()) ||
          hasSuffixMatch(collectionSlug)
        ) {
          console.log(`[CollectionMiddleware] Found match via fallback: ${key} for requested ${slug}`);
          collectionEntry = entry;
          break;
        }
      }
    }
    
    if (!collectionEntry) {
      const registeredCollections = (manager as any).registeredCollections as Map<string, any>;
      const allRegistered = Array.from(registeredCollections.entries());
      const publicCollections = allRegistered
        .filter(([_, entry]) => !entry.collection.admin?.hidden)
        .map(([key, _]) => key);
      
      console.error(`[CollectionMiddleware] Collection NOT FOUND: "${slug}". Available: ${publicCollections.join(', ')}`);
      
      return res.status(404).json({ 
          error: `Collection "${slug}" not found`,
          available: (req as any).user?.roles?.includes('admin') ? publicCollections : undefined
      });
    }

    // Security: If accessed via a plugin-scoped route (e.g. /api/v1/:pluginSlug/:slug),
    // ensure the collection actually belongs to that plugin to prevent cross-plugin data access.
    // NOTE: For /api/v1/collections/:slug, requestedPluginSlug will be undefined, so this check is skipped.
    const { pluginSlug: requestedPluginSlug } = req.params;
    if (requestedPluginSlug && collectionEntry.pluginSlug !== requestedPluginSlug) {
       // Also allow if the slug matches the full prefixed name, indicating the caller is using the full identifier
       if (slug !== collectionEntry.collection.slug) {
          return res.status(404).json({
              error: `Collection "${slug}" not found in plugin namespace "${requestedPluginSlug}"`
          });
       }
    }

    // Check if the plugin that registered this collection is active
    if (collectionEntry.pluginSlug !== 'system') {
      const plugin = manager.getPlugins().find(p => p.manifest.slug === collectionEntry.pluginSlug);
      if (!plugin || plugin.state !== 'active') {
        return res.status(403).json({ 
          error: `Collection "${slug}" is unavailable because plugin "${collectionEntry.pluginSlug}" is ${plugin?.state || 'missing'}`,
          code: 'PLUGIN_DISABLED'
        });
      }
    }

    req.collection = collectionEntry.collection;
    next();
  };
};
