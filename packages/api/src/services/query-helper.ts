import { Collection } from '@fromcode119/sdk';
import { createDynamicTable } from '@fromcode119/database';
import { timestamp, desc, sql, and, ilike, like, or } from '@fromcode119/database';

export class QueryHelper {
  private static virtualTables: Map<string, any> = new Map();

  /**
   * Generates or retrieves a Drizzle table object for a given collection definition.
   */
  public static getVirtualTable(collection: Collection) {
    if (this.virtualTables.has(collection.slug)) {
      return this.virtualTables.get(collection.slug);
    }

    const useTimestamps = collection.timestamps !== undefined ? collection.timestamps : true;
    const hasWorkflow = !!collection.workflow;

    const table = createDynamicTable({
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

  public static buildWhereClause(collection: Collection, table: any, filters: any, search?: string, dialect: string = 'postgres') {
    const whereChunks: any[] = [];
    const likeOp = dialect === 'postgres' ? ilike : like;

    // Handle Search (across all text/textarea fields)
    if (search) {
      const searchFields = collection.fields.filter(f => f.type === 'text' || f.type === 'textarea');
      if (searchFields.length > 0) {
        whereChunks.push(or(...searchFields.map(f => likeOp(table[f.name], `%${search}%`))));
      }
    }

    // Handle Filters
    Object.entries(filters).forEach(([key, value]) => {
      const column = table[key];
      if (column) {
         whereChunks.push(sql`${column} = ${value}`);
      } else if (key === 'created_at' && table['createdAt']) {
         whereChunks.push(sql`${table['createdAt']} = ${value}`);
      } else if (key === 'updated_at' && table['updatedAt']) {
         whereChunks.push(sql`${table['updatedAt']} = ${value}`);
      }
    });

    return whereChunks.length > 0 ? and(...whereChunks) : undefined;
  }

  public static buildOrderBy(collection: Collection, table: any, sort?: string) {
    const pk = collection.primaryKey || 'id';
    let orderBy: any[] = [table[pk] ? desc(table[pk]) : desc(sql`1`)]; 
    
    if (sort) {
      const isDesc = sort.startsWith('-');
      const fieldName = isDesc ? sort.substring(1) : sort;
      if (table[fieldName]) {
        orderBy = [isDesc ? desc(table[fieldName]) : sql`${table[fieldName]} asc`];
      }
    }
    return orderBy;
  }
}