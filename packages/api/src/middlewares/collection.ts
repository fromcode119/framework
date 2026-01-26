import { Request, Response, NextFunction } from 'express';
import { PluginManager } from '@fromcode/core';

export const createCollectionMiddleware = (manager: PluginManager) => {
  return (req: any, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const collectionEntry = manager.getCollection(slug);
    
    if (!collectionEntry) {
      return res.status(404).json({ error: `Collection "${slug}" not found` });
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
