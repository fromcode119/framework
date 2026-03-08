import { Request, Response, NextFunction } from 'express';
import { PluginManager } from '@fromcode119/core';
import { BaseMiddleware } from './BaseMiddleware';

/**
 * Middleware for collection lookup and validation.
 * 
 * Responsibilities:
 * - Resolves collection slug to collection definition
 * - Validates collection exists and is accessible
 * - Checks plugin status (active/inactive)
 * - Prevents cross-plugin data access
 * - Attaches collection to req.collection
 * 
 * @example
 * ```typescript
 * const middleware = new CollectionMiddleware(pluginManager);
 * router.get('/collections/:slug', middleware.middleware(), handler);
 * ```
 */
export class CollectionMiddleware extends BaseMiddleware {
  constructor(private manager: PluginManager) {
    super();
  }

  async handle(req: any, res: Response, next: NextFunction): Promise<void> {
    let { slug, pluginSlug: requestedPluginSlug } = req.params;
    
    if (!slug) {
      res.status(400).json({ error: 'Collection slug is required' });
      return;
    }

    // Special case: If requested via /api/v1/collections/:slug, the router might
    // have captured "collections" as a plugin slug if mounted broadly.
    // We treat "collections" as an instruction the user wants a global lookup.
    if (requestedPluginSlug === 'collections') {
      requestedPluginSlug = undefined;
    }

    const targetSlug = slug.toLowerCase();
    const targetPluginSlug = requestedPluginSlug?.toLowerCase();

    // First try: Exact match (usually the full prefixed slug)
    let collectionEntry = this.manager.getCollection(slug);
    
    // Second try: If requested via plugin namespace, try the standard prefixed format
    if (!collectionEntry && targetPluginSlug) {
      const standardPrefixed = `fcp_${targetPluginSlug.replace(/-/g, '_')}_${targetSlug}`;
      collectionEntry = this.manager.getCollection(standardPrefixed);
    }

    // Third try: Case-insensitive search through all collections by slug, shortSlug or unprefixedSlug
    if (!collectionEntry) {
      collectionEntry = this.findCollectionByFuzzyMatch(targetSlug, targetPluginSlug);
    }
    
    if (!collectionEntry) {
      this.handleCollectionNotFound(slug, requestedPluginSlug, req, res);
      return;
    }

    // Security: If accessed via a plugin-scoped route (e.g. /api/v1/:pluginSlug/:slug),
    // ensure the collection actually belongs to that plugin to prevent cross-plugin data access.
    // NOTE: For /api/v1/collections/:slug, requestedPluginSlug will be undefined, so this check is skipped.
    if (targetPluginSlug && collectionEntry.pluginSlug?.toLowerCase() !== targetPluginSlug) {
       // Also allow if the slug matches the full prefixed name, indicating the caller is using the full identifier
       if (targetSlug !== collectionEntry.collection.slug?.toLowerCase()) {
          res.status(404).json({
              error: `Collection "${slug}" not found in plugin namespace "${requestedPluginSlug}"`
          });
          return;
       }
    }

    // Check if the plugin that registered this collection is active
    if (collectionEntry.pluginSlug !== 'system') {
      const plugin = this.manager.getPlugins().find(p => p.manifest.slug === collectionEntry.pluginSlug);
      if (!plugin || plugin.state !== 'active') {
        res.status(403).json({ 
          error: `Collection "${slug}" is unavailable because plugin "${collectionEntry.pluginSlug}" is ${plugin?.state || 'missing'}`,
          code: 'PLUGIN_DISABLED'
        });
        return;
      }
    }

    req.collection = collectionEntry.collection;
    next();
  }

  /**
   * Find collection using fuzzy matching strategies.
   * Searches by suffix match on slug, shortSlug, and unprefixedSlug.
   */
  private findCollectionByFuzzyMatch(targetSlug: string, targetPluginSlug?: string): any {
    const registeredCollections = (this.manager as any).registeredCollections as Map<string, any>;
    const allEntries = Array.from(registeredCollections.entries());

    // Filter and sort entries to prioritize the requested plugin if available
    const potentialMatches = allEntries.filter(([key, entry]) => {
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

      return (
        key.toLowerCase() === targetSlug || 
        collectionSlug === targetSlug || 
        shortSlug === targetSlug ||
        unprefixedSlug === targetSlug ||
        hasSuffixMatch(key.toLowerCase()) ||
        hasSuffixMatch(collectionSlug)
      );
    });

    if (potentialMatches.length > 0) {
      // Prioritize match from the requested plugin
      const bestMatch = targetPluginSlug 
        ? potentialMatches.find(([_, entry]) => entry.pluginSlug?.toLowerCase() === targetPluginSlug) || potentialMatches[0]
        : potentialMatches[0];
      
      console.log(`[CollectionMiddleware] Found match via fallback: ${bestMatch[0]} for requested ${targetSlug} (Namespace: ${targetPluginSlug || 'none'})`);
      return bestMatch[1];
    }

    return null;
  }

  /**
   * Handle collection not found error with helpful diagnostics.
   */
  private handleCollectionNotFound(slug: string, requestedPluginSlug: string | undefined, req: any, res: Response) {
    const registeredCollections = (this.manager as any).registeredCollections as Map<string, any>;
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
}
