import { IDatabaseManager, TableResolver, normalizeFindOptions, normalizeWhereClause, normalizeRecord } from '@fromcode119/database';
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
    this.entityMap.set(`${pluginSlug}.${entityName}`, tableName);
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
      
      // Fallback to default naming convention if not explicitly registered
      const [plugin, ...rest] = identifier.slice(1).split('/');
      const table = rest.join('_');
      return `fcp_${plugin.replace(/-/g, '_')}_${table}`;
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
        } as CollectionQueryBuilder;
      }
    };

    return new Proxy(pluginProxy, {
      get: (target, prop) => {
        if (prop in target || typeof prop !== 'string') {
          return (target as any)[prop];
        }
        // Semantic shortcut: getPlugin('content').pages -> target.collection('pages')
        return target.collection(prop);
      }
    });
  }
}

export const getPlugin = (slug: string) => PluginRegistry.getInstance().getPlugin(slug);
export const registry = PluginRegistry.getInstance();
