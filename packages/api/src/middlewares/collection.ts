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
        const unprefixedSlug = entry.collection.unprefixedSlug?.toLowerCase();
        
        if (
          key.toLowerCase() === targetSlug || 
          collectionSlug === targetSlug || 
          shortSlug === targetSlug ||
          unprefixedSlug === targetSlug ||
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
      const allRegistered = Array.from(((manager as any).registeredCollections as Map<string, any>).entries());
      const publicCollections = allRegistered
        .filter(([_, entry]) => !entry.collection.admin?.hidden)
        .map(([key, _]) => key);
      
      // Calculate a "Did you mean?" suggestion
      const findBestMatch = (input: string, choices: string[]) => {
        const inputLo = input.toLowerCase();
        for (const choice of choices) {
          const choiceLo = choice.toLowerCase();
          // Simple fuzzy logic: check if one contains other or simple distance
          if (choiceLo.includes(inputLo) || inputLo.includes(choiceLo)) {
             return choice;
          }
        }
        return null;
      };

      const suggestion = findBestMatch(slug, publicCollections);
      
      console.error(`[CollectionMiddleware] Collection NOT FOUND: "${slug}". Suggestion: ${suggestion}. Available: ${publicCollections.join(', ')}`);
      
      return res.status(404).json({ 
          error: `Collection "${slug}" not found`,
          message: suggestion ? `Did you mean "${suggestion}"?` : `The collection "${slug}" does not exist in the platform registry.`,
          available: (req as any).user?.roles?.includes('admin') ? publicCollections : undefined,
          hint: suggestion ? `Try requesting /api/v1/collections/${suggestion} instead.` : undefined
      });
    }

    // Security: If accessed via a plugin-scoped route (e.g. /api/v1/:pluginSlug/:slug),
    // ensure the collection actually belongs to that plugin to prevent cross-plugin data access.
    const { pluginSlug: requestedPluginSlug } = req.params;
    if (requestedPluginSlug && collectionEntry.pluginSlug !== requestedPluginSlug) {
      return res.status(404).json({
          error: `Collection "${slug}" not found in plugin namespace "${requestedPluginSlug}"`
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
