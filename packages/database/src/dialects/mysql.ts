import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql, eq, and, count as drizzleCount, desc, asc } from 'drizzle-orm';
import { mysqlTable, text } from 'drizzle-orm/mysql-core';
import { IDatabaseManager } from '../index';

export class MysqlDatabaseManager implements IDatabaseManager {
  private pool: mysql.Pool;
  public readonly drizzle: any;
  public readonly dialect = 'mysql' as const;

  constructor(connection: string) {
    this.pool = mysql.createPool(connection);
    this.drizzle = drizzle(this.pool);
  }

  async connect() {
    await this.pool.getConnection();
  }

  async execute(query: any) {
    return this.drizzle.execute(query);
  }

  private getDynamicTable(tableName: string, columns: string[]) {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = text(col);
    }
    return mysqlTable(tableName, tableColumns);
  }

  async find(tableName: string, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns } = options;
    
    let query;
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

    const [rows] = await query;
    return rows || [];
  }

  async findOne(tableName: string, where: any): Promise<any | null> {
    const results = await this.find(tableName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableName: string, data: any): Promise<any> {
    const columns = Object.keys(data);
    const table = this.getDynamicTable(tableName, columns);
    const [result] = await this.drizzle.insert(table).values(data);
    
    // MySQL insert doesn't return the row with .returning() usually (depends on driver/version)
    // For now, return what we have or try to fetch it if needed.
    // In many cases, result.insertId is useful.
    return { ...data, id: result.insertId };
  }

  async update(tableName: string, where: any, data: any): Promise<any> {
    const allColumns = [...new Set([...Object.keys(where), ...Object.keys(data)])];
    const table = this.getDynamicTable(tableName, allColumns);
    
    const conditions = Object.entries(where).map(([k, v]) => eq(table[k], v as any));
    
    await this.drizzle
      .update(table)
      .set(data)
      .where(and(...conditions));
    
    return this.findOne(tableName, where);
  }

  async delete(tableName: string, where: any): Promise<boolean> {
    const columns = Object.keys(where);
    const table = this.getDynamicTable(tableName, columns);
    
    const conditions = Object.entries(where).map(([k, v]) => eq(table[k], v as any));
    const [result] = await this.drizzle.delete(table).where(and(...conditions));
    return result.affectedRows > 0;
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
    return Number(result[0]?.total || 0);
  }
}
