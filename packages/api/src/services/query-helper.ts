import { Collection } from '@fromcode119/core';
import { DynamicSchema, IDatabaseManager, timestamp, sql } from '@fromcode119/database';

export class QueryHelper {
  private static virtualTables: Map<string, any> = new Map();
  private static readonly searchableFieldTypes = new Set(['text', 'textarea', 'select', 'number']);

  /**
   * Generates or retrieves a Drizzle table object for a given collection definition.
   */
  public static getVirtualTable(collection: Collection) {
    if (this.virtualTables.has(collection.slug)) {
      return this.virtualTables.get(collection.slug);
    }

    const useTimestamps = collection.timestamps !== undefined ? collection.timestamps : true;
    const hasWorkflow = !!collection.workflow;

    const table = DynamicSchema.createDynamicTable({
      slug: collection.tableName || collection.slug,
      fields: collection.fields.map(f => ({ 
        name: f.name, 
        type: f.type 
      })),
      primaryKey: collection.primaryKey || 'id',
      timestamps: useTimestamps,
      workflow: hasWorkflow
    });

    if (useTimestamps) {
      if (!(table as any).createdAt) {
        (table as any).createdAt = timestamp('created_at', { withTimezone: true });
      }
      if (!(table as any).updatedAt) {
        (table as any).updatedAt = timestamp('updated_at', { withTimezone: true });
      }
    }

    this.virtualTables.set(collection.slug, table);
    return table;
  }

  public static buildWhereClause(db: IDatabaseManager, collection: Collection, table: any, filters: any, search?: string) {
    const whereChunks: any[] = [];

    // Handle Search across top-level scalar fields that users expect in the admin table.
    const normalizedSearch = QueryHelper.normalizeSearch(search);
    if (normalizedSearch) {
      const searchClauses = collection.fields
        .filter((field) => QueryHelper.searchableFieldTypes.has(field.type) && table[field.name])
        .map((field) => QueryHelper.buildSearchClause(db, table[field.name], normalizedSearch));
      if (searchClauses.length > 0) {
        whereChunks.push(db.or(...searchClauses));
      }
    }

    // Handle Filters
    Object.entries(filters).forEach(([key, value]) => {
      const column = table[key];
      if (column) {
         whereChunks.push(db.eq(column, value));
      } else if (key === 'created_at' && table['createdAt']) {
         whereChunks.push(db.eq(table['createdAt'], value));
      } else if (key === 'updated_at' && table['updatedAt']) {
         whereChunks.push(db.eq(table['updatedAt'], value));
      }
    });

    return whereChunks.length > 0 ? db.and(...whereChunks) : undefined;
  }

  private static buildSearchClause(db: IDatabaseManager, column: any, search: string) {
    return db.like(sql`LOWER(CAST(${column} AS TEXT))`, `%${search}%`);
  }

  private static normalizeSearch(search?: string): string {
    return String(search || '').trim().toLowerCase();
  }

  public static buildOrderBy(db: IDatabaseManager, collection: Collection, table: any, sort?: string) {
    const pk = collection.primaryKey || 'id';
    let orderBy: any[] = [table[pk] ? db.desc(table[pk]) : db.desc(sql`1`)]; 
    
    if (sort) {
      const isDesc = sort.startsWith('-');
      const fieldName = isDesc ? sort.substring(1) : sort;
      if (table[fieldName]) {
        orderBy = [isDesc ? db.desc(table[fieldName]) : sql`${table[fieldName]} asc`];
      }
    }
    return orderBy;
  }
}
