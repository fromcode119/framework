import type { Request, Response } from 'express';
import type { PluginManager } from '@fromcode119/core';

/**
 * The plugin tables the audit-trail exclusion can name (Settings → Security → Audit Trail).
 *
 * That setting stores physical table names, and the operator used to have to type them. This lists every
 * table a plugin registered — its plugin, its collection and the physical name the audit compares
 * against — so the console offers a pick list instead. Read-only; it says nothing a plugin list does not.
 */
export class AuditTableCatalogController {
  constructor(private readonly manager: PluginManager) {}

  async list(_req: Request, res: Response): Promise<void> {
    const tables = this.manager.getCollections()
      .map((collection) => ({
        table: collection.slug,
        plugin: this.manager.getCollection(collection.slug)?.pluginSlug ?? '',
        collection: collection.shortSlug || collection.slug,
      }))
      .filter((entry) => entry.plugin && entry.plugin !== 'system')
      .sort((a, b) => a.plugin.localeCompare(b.plugin) || a.collection.localeCompare(b.collection));
    res.json({ tables });
  }
}
