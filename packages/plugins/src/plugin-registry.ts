import { IDatabaseManager, TableResolver, NamingStrategy, PhysicalTableNameUtils } from '@fromcode119/database';

import { CollectionQueryBuilder } from './types';

/**
 * Registry for plugins and their associated entities (tables).
 * 
 * Provides a cohesive API for accessing plugin collections with automatic
 * camelCase to snake_case field name conversion and table name resolution.
 */
export class PluginRegistry {
  private static instance: PluginRegistry;
  private db?: IDatabaseManager;
  private entityMap: Map<string, string> = new Map(); // e.g., "content.pages" -> physical table name

  private constructor() {
    // Automatically register this registry as the global table resolver
    TableResolver.set((name: any) => this.resolveEntity(name));
  }

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  setDatabase(db: IDatabaseManager) {
    this.db = db;
  }

  /**
   * Register a mapping from a semantic identifier to a physical table name.
   */
  registerEntity(pluginSlug: string, entityName: string, tableName: string) {
    PluginRegistry.registerEntityAliases(this.entityMap, pluginSlug, entityName, tableName);
  }

  /**
   * Resolve a semantic identifier to a physical table name.
   */
  resolveEntity(identifier: any): any {
    if (typeof identifier !== 'string') return identifier;

    // Handle @plugin/entity format
    if (identifier.startsWith('@')) {
      const cleaned = identifier.slice(1).replace('/', '.');
      const resolved = this.entityMap.get(cleaned);
      if (resolved) return resolved;

      const [plugin, ...restParts] = identifier.slice(1).split('/');
      const rawEntity = restParts.join('_');
      const variants = new Set<string>([
        rawEntity,
        PluginRegistry.camelToKebab(rawEntity),
        PluginRegistry.kebabToCamel(rawEntity),
        NamingStrategy.toSnakeIdentifier(rawEntity),
      ]);
      for (const variant of variants) {
        if (!variant) continue;
        const aliased = this.entityMap.get(`${plugin}.${variant}`);
        if (aliased) return aliased;
      }
      
      // Fallback to default naming convention if not explicitly registered
      const normalizedPlugin = NamingStrategy.toSnakeIdentifier(plugin);
      const normalizedTable = NamingStrategy.toSnakeIdentifier(rawEntity);
      return PhysicalTableNameUtils.create(normalizedPlugin, normalizedTable);
    }
    
    return this.entityMap.get(identifier) || identifier;
  }

  /**
   * Returns a cohesive proxy for a plugin.
   * Usage: getPlugin('content').pages.find()
   * or: getPlugin('content').collection('pages').find()
   */
  getPlugin(slug: string): any {
    const pluginProxy = {
      slug,
      collection: (name: string) => {
        if (!this.db) throw new Error(`Database not initialized in PluginRegistry. Cannot access @${slug}/${name}`);
        const resolvedTable = this.resolveEntity(`@${slug}/${name}`);

        const normalizeWhere = (value: any) => NamingStrategy.normalizeWhereClause(value);
        const normalizeRecord = (value: any) => NamingStrategy.normalizeRecord(value);
        const isEmptyRecord = (value: any) =>
          NamingStrategy.isPlainObject(value) && Object.keys(value).length === 0;
        
        return {
          find: (opts: any) => this.db!.find(resolvedTable, NamingStrategy.normalizeFindOptions(opts)),
          findOne: (where: any) => this.db!.findOne(resolvedTable, normalizeWhere(where)),
          insert: (data: any) => this.db!.insert(resolvedTable, normalizeRecord(data)),
          update: async (where: any, data: any) => {
            const normalizedWhere = normalizeWhere(where);
            const normalizedRecord = normalizeRecord(data);

            // Treat empty updates as a no-op so compatibility filters in seeds and
            // plugin utilities do not fail the whole operation after stripping
            // unsupported fields for an older schema variant.
            if (isEmptyRecord(normalizedRecord)) {
              return this.db!.findOne(resolvedTable, normalizedWhere);
            }

            return this.db!.update(resolvedTable, normalizedWhere, normalizedRecord);
          },
          delete: (where: any) => this.db!.delete(resolvedTable, normalizeWhere(where)),
          count: (where: any) => this.db!.count(resolvedTable, { where: normalizeWhere(where) }),
          
          // Helper methods
          firstOrCreate: async (where: any, data: any) => {
            const normalizedWhere = normalizeWhere(where);
            const normalizedRecord = normalizeRecord(data);
            const existing = await this.db!.findOne(resolvedTable, normalizedWhere);
            if (existing) return { record: existing, created: false };
            const created = await this.db!.insert(resolvedTable, normalizedRecord);
            return { record: created, created: true };
          },
          
          updateOrCreate: async (where: any, data: any) => {
            const normalizedWhere = normalizeWhere(where);
            const normalizedRecord = normalizeRecord(data);
            const existing = await this.db!.findOne(resolvedTable, normalizedWhere);
            if (existing) {
              if (isEmptyRecord(normalizedRecord)) {
                return { record: existing, created: false };
              }
              const updated = await this.db!.update(resolvedTable, normalizedWhere, normalizedRecord);
              return { record: updated, created: false };
            }
            const created = await this.db!.insert(resolvedTable, normalizedRecord);
            return { record: created, created: true };
          },
          
          findOrFail: async (where: any) => {
            const record = await this.db!.findOne(resolvedTable, normalizeWhere(where));
            if (!record) throw new Error(`Record not found in ${resolvedTable} with criteria: ${JSON.stringify(where)}`);
            return record;
          },
        } as CollectionQueryBuilder;
      }
    };

    return new Proxy(pluginProxy, {
      get: (target, prop) => {
        if (prop in target || typeof prop !== 'string') {
          return (target as any)[prop];
        }
        // Semantic shortcut: getPlugin('content').pages -> target.collection('pages')
        // Convert camelCase to kebab-case for collection names
        const collectionName = PluginRegistry.camelToKebab(prop);
        return target.collection(collectionName);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Static convenience methods — delegate to singleton instance
  // ---------------------------------------------------------------------------

  static setDatabase(db: IDatabaseManager) {
    PluginRegistry.getInstance().setDatabase(db);
  }

  static registerEntity(pluginSlug: string, entityName: string, tableName: string) {
    PluginRegistry.getInstance().registerEntity(pluginSlug, entityName, tableName);
  }

  static getPlugin(slug: string): any {
    return PluginRegistry.getInstance().getPlugin(slug);
  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  /**
   * Convert camelCase to kebab-case.
   * Example: "paymentMethods" -> "payment-methods"
   */
  private static camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  private static kebabToCamel(str: string): string {
    return String(str || '').replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  }

  private static registerEntityAliases(
    map: Map<string, string>,
    pluginSlug: string,
    entityName: string,
    tableName: string
  ) {
    const pluginKey = String(pluginSlug || '').trim();
    const entity = String(entityName || '').trim();
    if (!pluginKey || !entity) return;

    const candidates = new Set<string>([
      entity,
      PluginRegistry.camelToKebab(entity),
      PluginRegistry.kebabToCamel(entity),
      NamingStrategy.toSnakeIdentifier(entity),
    ]);

    for (const candidate of candidates) {
      if (!candidate) continue;
      map.set(`${pluginKey}.${candidate}`, tableName);
    }
  }
}
