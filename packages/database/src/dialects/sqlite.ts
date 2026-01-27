import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, and, count as drizzleCount, desc, asc } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { IDatabaseManager } from '../index';

export class SqliteDatabaseManager implements IDatabaseManager {
  private sqlite: Database.Database;
  public readonly drizzle: any;
  public readonly dialect = 'sqlite' as const;

  constructor(connection: string) {
    const dbPath = connection.startsWith('sqlite:') ? connection.replace('sqlite:', '') : connection;
    this.sqlite = new Database(dbPath);
    this.drizzle = drizzle(this.sqlite);
  }

  async connect() {
    // SQLite is synchronous and connects immediately
  }

  async execute(query: any) {
    return this.drizzle.run(query);
  }

  private getDynamicTable(tableName: string, columns: string[]) {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = text(col);
    }
    return sqliteTable(tableName, tableColumns);
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns } = options;
    
    let query;
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      if (columns && Object.keys(columns).length > 0) {
        const selectFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(columns)) {
          if (value) {
            selectFields[key] = sql`${sql.identifier(key)}`;
          }
        }
        query = this.drizzle.select(selectFields).from(sql`${sql.identifier(tableName)}`);
      } else {
        query = this.drizzle.select().from(sql`${sql.identifier(tableName)}`);
      }
    } else {
      query = this.drizzle.select().from(tableOrName);
    }

    if (where) {
      if (typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
        const conditions = Object.entries(where).map(([k, v]) => eq(sql`${sql.identifier(k)}`, v as any));
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      } else {
        query = query.where(where);
      }
    }

    if (orderBy) {
      if (Array.isArray(orderBy)) {
        query = query.orderBy(...orderBy);
      } else if (typeof orderBy === 'string') {
        const [column, direction] = orderBy.split(' ');
        const orderFn = direction?.toLowerCase() === 'desc' ? desc : asc;
        query = query.orderBy(orderFn(sql.identifier(column)));
      } else {
        query = query.orderBy(orderBy);
      }
    }

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    return await query;
  }

  async findOne(tableOrName: any, where: any): Promise<any | null> {
    const results = await this.find(tableOrName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableOrName: any, data: any): Promise<any> {
    let table;
    if (typeof tableOrName === 'string') {
      const columns = Object.keys(data);
      table = this.getDynamicTable(tableOrName, columns);
    } else {
      table = tableOrName;
    }
    const [result] = await this.drizzle.insert(table).values(data).returning();
    return result;
  }

  async update(tableOrName: any, where: any, data: any): Promise<any> {
    let table;
    if (typeof tableOrName === 'string') {
      const allColumns = [...new Set([...Object.keys(where), ...Object.keys(data)])];
      table = this.getDynamicTable(tableOrName, allColumns);
    } else {
      table = tableOrName;
    }
    
    const conditions = Object.entries(where).map(([k, v]) => {
      const col = table[k] || sql`${sql.identifier(k)}`;
      return eq(col, v as any);
    });
    
    const [result] = await this.drizzle
      .update(table)
      .set(data)
      .where(and(...conditions))
      .returning();
    
    return result;
  }

  async delete(tableOrName: any, where: any): Promise<boolean> {
    let table;
    if (typeof tableOrName === 'string') {
      const columns = Object.keys(where);
      table = this.getDynamicTable(tableOrName, columns);
    } else {
      table = tableOrName;
    }
    
    const conditions = Object.entries(where).map(([k, v]) => {
      const col = table[k] || sql`${sql.identifier(k)}`;
      return eq(col, v as any);
    });
    const result = await this.drizzle.delete(table).where(and(...conditions)).returning();
    return result.length > 0;
  }

  async count(tableName: string, where: any = {}): Promise<number> {
    let query = this.drizzle.select({ total: drizzleCount() }).from(sql`${sql.identifier(tableName)}`);
    
    if (where) {
      if (typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
        const conditions = Object.entries(where).map(([k, v]) => eq(sql`${sql.identifier(k)}`, v as any));
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      } else if (Object.keys(where).length > 0) {
        query = query.where(where);
      }
    }

    const [result] = await query;
    return Number(result?.total || 0);
  }
}
