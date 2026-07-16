import { Request, Response, NextFunction } from 'express';
import { CoreServices, PluginManager, PluginState } from '@fromcode119/core';
import { NamingStrategy } from '@fromcode119/database';
import { BaseMiddleware } from './base-middleware';

const RELATIONSHIP_SEARCH_TEXT_TYPES = new Set(['text', 'textarea', 'select']);

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

    let collectionEntry = this.manager.getCollection(slug);
    if (!collectionEntry) {
      const resolvedSlug = CoreServices.getInstance().collectionIdentity.resolveRegisteredSlug(
        slug,
        this.manager.getCollections(),
        targetPluginSlug,
      );
      if (resolvedSlug) {
        collectionEntry = this.manager.getCollection(resolvedSlug);
      }
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
      if (!plugin || plugin.state !== PluginState.ACTIVE) {
        res.status(403).json({ 
          error: `Collection "${slug}" is unavailable because plugin "${collectionEntry.pluginSlug}" is ${plugin?.state || 'missing'}`,
          code: 'PLUGIN_DISABLED'
        });
        return;
      }
    }

    req.collection = collectionEntry.collection;
    // Resolve each relationship field's related table + searchable text columns so the list search
    // can match by the RELATED record's name (e.g. inventory by product name), not just scalar
    // columns on this table. The middleware owns the registry, so it does the relationTo resolution.
    req.relationshipSearchTargets = this.buildRelationshipSearchTargets(collectionEntry.collection);
    next();
  }

  /**
   * For every single-value relationship field, resolve the related collection and return a descriptor
   * { field, tableName, columns, primaryKey } the read controller uses to find matching related ids.
   * hasMany relationships are skipped (they store JSON arrays, not a scalar id `inArray` can match).
   */
  private buildRelationshipSearchTargets(
    collection: any,
  ): Array<{ field: string; tableName: string; columns: string[]; primaryKey: string }> {
    const targets: Array<{ field: string; tableName: string; columns: string[]; primaryKey: string }> = [];
    // Collections are registered under their PHYSICAL slug (e.g. `fcp_ecommerce_products`), but a
    // relationship's `relationTo` is the logical collection slug (`ecommerce-products`). Resolve by
    // matching `.slug`/`.shortSlug` across the registry rather than a direct key lookup, which misses.
    const allCollections = this.manager.getCollections();
    const collectionIdentity = CoreServices.getInstance().collectionIdentity;
    for (const field of (collection?.fields || [])) {
      if (field?.type !== 'relationship' || !field?.relationTo || field?.hasMany) continue;
      // `relationTo` is the logical slug (`ecommerce-products`); registered collections are keyed by
      // their PHYSICAL slug (`fcp_ecommerce_products`). Resolve logical→registered the same way the
      // request slug is resolved, then fetch the registered collection.
      const resolvedSlug = collectionIdentity.resolveRegisteredSlug(field.relationTo, allCollections, undefined);
      const related = resolvedSlug ? this.manager.getCollection(resolvedSlug)?.collection : undefined;
      if (!related) continue;
      const columns = new Set<string>();
      if (related.admin?.useAsTitle) columns.add(NamingStrategy.toSnakeCase(related.admin.useAsTitle));
      for (const relatedField of (related.fields || [])) {
        if (RELATIONSHIP_SEARCH_TEXT_TYPES.has(relatedField?.type)) {
          columns.add(NamingStrategy.toSnakeCase(relatedField.name));
        }
      }
      if (!columns.size) continue;
      targets.push({
        field: field.name,
        tableName: related.tableName || related.slug,
        columns: [...columns],
        primaryKey: related.primaryKey || 'id',
      });
    }
    return targets;
  }

  /**
   * Handle collection not found error with helpful diagnostics.
   */
  private handleCollectionNotFound(slug: string, requestedPluginSlug: string | undefined, req: any, res: Response) {
    // A plugin-scoped path (/:pluginSlug/:slug) reaches here only when the plugin's OWN routes did not
    // match. If that plugin exists but is not active, the request is almost certainly a plugin API call
    // (e.g. a build-server `/status` poll) that fell through because the plugin's routes are not mounted
    // yet — typically the brief window while the API restarts after a marketplace install. Report that as
    // a retryable "plugin not ready" 503 instead of a misleading "collection not found", so the UI backs
    // off and retries rather than surfacing a scary error the moment a new version is installed.
    if (requestedPluginSlug && requestedPluginSlug.toLowerCase() !== 'collections') {
      const plugin = this.manager.getPlugins().find(
        p => p.manifest.slug?.toLowerCase() === requestedPluginSlug.toLowerCase(),
      );
      if (plugin && plugin.state !== PluginState.ACTIVE) {
        res.status(503).json({
          error: `Plugin "${requestedPluginSlug}" is not ready (state: ${plugin.state}). Retry shortly.`,
          code: 'PLUGIN_UNAVAILABLE',
        });
        return;
      }
    }

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
