import { IDatabaseManager, TableResolver, normalizeFindOptions, normalizeWhereClause, normalizeRecord } from '@fromcode119/database';
import { toSnakeIdentifier } from '@fromcode119/database/naming-strategy';
import { CollectionQueryBuilder } from './types';

/**
 * Convert camelCase to kebab-case
 * Example: "paymentMethods" -> "payment-methods"
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function kebabToCamel(str: string): string {
  return String(str || '').replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function registerEntityAliases(
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
    camelToKebab(entity),
    kebabToCamel(entity),
    toSnakeIdentifier(entity),
  ]);

  for (const candidate of candidates) {
    if (!candidate) continue;
    map.set(`${pluginKey}.${candidate}`, tableName);
  }
}

/**
 * Registry for plugins and their associated entities (tables).
 * 
 * Provides a cohesive API for accessing plugin collections with automatic
 * camelCase to snake_case field name conversion and table name resolution.
 */
export class PluginRegistry {
  private static instance: PluginRegistry;
  private db?: IDatabaseManager;
  private entityMap: Map<string, string> = new Map(); // e.g., "content.pages" -> "fcp_content_pages"

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
    registerEntityAliases(this.entityMap, pluginSlug, entityName, tableName);
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
        camelToKebab(rawEntity),
        kebabToCamel(rawEntity),
        toSnakeIdentifier(rawEntity),
      ]);
      for (const variant of variants) {
        if (!variant) continue;
        const aliased = this.entityMap.get(`${plugin}.${variant}`);
        if (aliased) return aliased;
      }
      
      // Fallback to default naming convention if not explicitly registered
      const normalizedPlugin = toSnakeIdentifier(plugin);
      const normalizedTable = toSnakeIdentifier(rawEntity);
      return `fcp_${normalizedPlugin}_${normalizedTable}`;
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
        
        return {
          find: (opts: any) => this.db!.find(resolvedTable, normalizeFindOptions(opts)),
          findOne: (where: any) => this.db!.findOne(resolvedTable, normalizeWhereClause(where)),
          insert: (data: any) => this.db!.insert(resolvedTable, normalizeRecord(data)),
          update: (where: any, data: any) => this.db!.update(resolvedTable, normalizeWhereClause(where), normalizeRecord(data)),
          delete: (where: any) => this.db!.delete(resolvedTable, normalizeWhereClause(where)),
          count: (where: any) => this.db!.count(resolvedTable, { where: normalizeWhereClause(where) }),
          
          // Helper methods
          firstOrCreate: async (where: any, data: any) => {
            const existing = await this.db!.findOne(resolvedTable, normalizeWhereClause(where));
            if (existing) return { record: existing, created: false };
            const created = await this.db!.insert(resolvedTable, normalizeRecord(data));
            return { record: created, created: true };
          },
          
          updateOrCreate: async (where: any, data: any) => {
            const existing = await this.db!.findOne(resolvedTable, normalizeWhereClause(where));
            if (existing) {
              const updated = await this.db!.update(resolvedTable, normalizeWhereClause(where), normalizeRecord(data));
              return { record: updated, created: false };
            }
            const created = await this.db!.insert(resolvedTable, normalizeRecord(data));
            return { record: created, created: true };
          },
          
          findOrFail: async (where: any) => {
            const record = await this.db!.findOne(resolvedTable, normalizeWhereClause(where));
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
        const collectionName = camelToKebab(prop);
        return target.collection(collectionName);
      }
    });
  }
}

export const getPlugin = (slug: string) => PluginRegistry.getInstance().getPlugin(slug);
export const registry = PluginRegistry.getInstance();
