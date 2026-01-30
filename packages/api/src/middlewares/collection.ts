import { Request, Response, NextFunction } from 'express';
import { PluginManager } from '@fromcode/core';

export const createCollectionMiddleware = (manager: PluginManager) => {
  return (req: any, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    
    // First try: Exact match (usually the full prefixed slug)
    let collectionEntry = manager.getCollection(slug);
    
    // Second try: Case-insensitive search through all collections by slug or shortSlug
    if (!collectionEntry) {
      const registeredCollections = (manager as any).registeredCollections as Map<string, any>;
      const targetSlug = slug.toLowerCase();
      
      console.log(`[CollectionMiddleware] Attempting fallback for "${slug}". Registered:`, Array.from(registeredCollections.keys()));

      for (const [key, entry] of Array.from(registeredCollections.entries())) {
        const collectionSlug = entry.collection.slug?.toLowerCase();
        const shortSlug = entry.collection.shortSlug?.toLowerCase();
        
        if (
          key.toLowerCase() === targetSlug || 
          collectionSlug === targetSlug || 
          shortSlug === targetSlug ||
          key.toLowerCase().endsWith(`_${targetSlug}`) ||
          (collectionSlug && collectionSlug.endsWith(`_${targetSlug}`))
        ) {
          console.log(`[CollectionMiddleware] Found match via fallback: ${key} for requested ${slug}`);
          collectionEntry = entry;
          break;
        }
      }
    }
    
    if (!collectionEntry) {
      const logs = Array.from(((manager as any).registeredCollections as Map<string, any>).keys());
      console.error(`[CollectionMiddleware] Collection NOT FOUND: "${slug}". Available: ${logs.join(', ')}`);
      return res.status(404).json({ 
          error: `Collection "${slug}" not found`,
          available: logs
      });
    }

    // Check if the plugin that registered this collection is active
    // Special case for 'system' registered collections (which are always core)
    if (collectionEntry.pluginSlug !== 'system') {
      const plugin = manager.getPlugins().find(p => p.manifest.slug === collectionEntry.pluginSlug);
      if (!plugin || plugin.state !== 'active') {
        return res.status(403).json({ 
          error: `Collection "${slug}" is currently unavailable because its parent plugin "${collectionEntry.pluginSlug}" is disabled`,
          code: 'PLUGIN_DISABLED'
        });
      }
    }

    req.collection = collectionEntry.collection;
    next();
  };
};
