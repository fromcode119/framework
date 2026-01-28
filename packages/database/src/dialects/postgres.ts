import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql, eq, and, count as drizzleCount, desc, asc } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { IDatabaseManager } from '../index';

export class PostgresDatabaseManager implements IDatabaseManager {
  private pool: Pool;
  public readonly drizzle: any;
  public readonly dialect = 'postgresql' as const;

  constructor(connection: string) {
    this.pool = new Pool({ connectionString: connection });
    this.drizzle = drizzle(this.pool);
  }

  async connect() {
    const client = await this.pool.connect();
    client.release();
  }

  async execute(query: any) {
    if (typeof query === 'string') {
      return this.pool.query(query);
    }
    return this.drizzle.execute(query);
  }

  private getDynamicTable(tableName: string, columns: string[]) {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = text(col);
    }
    return pgTable(tableName, tableColumns);
  }

  async find(tableOrName: any, options: any = {}) {
    const { limit, offset, orderBy, where, columns } = options;
    
    // If it's a string (dynamic table), use raw SQL to ensure all columns are retrieved
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      let sqlQuery = `SELECT `;
      
      if (columns && Object.keys(columns).length > 0) {
        sqlQuery += Object.entries(columns)
          .filter(([_, v]) => v)
          .map(([k, _]) => `"${k}"`)
          .join(', ');
      } else {
        sqlQuery += `*`;
      }
      
      sqlQuery += ` FROM "${tableName}"`;
      
      const conditions: string[] = [];
      const values: any[] = [];
      
      if (where) {
        Object.entries(where).forEach(([k, v], i) => {
          conditions.push(`"${k}" = $${i + 1}`);
          values.push(v);
        });
        if (conditions.length > 0) {
          sqlQuery += ` WHERE ` + conditions.join(' AND ');
        }
      }
      
      if (orderBy) {
        sqlQuery += ` ORDER BY `;
        if (typeof orderBy === 'string') {
          sqlQuery += orderBy;
        } else {
          // Simplified order by for objects
          sqlQuery += Object.entries(orderBy).map(([k, v]) => `"${k}" ${v}`).join(', ');
        }
      }
      
      if (limit) sqlQuery += ` LIMIT ${limit}`;
      if (offset) sqlQuery += ` OFFSET ${offset}`;
      
      const result = await this.pool.query(sqlQuery, values);
      return result.rows;
    }

    // Otherwise use Drizzle for typed table objects
    let query = this.drizzle.select().from(tableOrName);

    if (where) {
      // If where is a simple record, convert it. If it's already a Drizzle clause (SQL object), use it directly.
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

  async findOne(tableOrName: any, where: any) {
    const results = await this.find(tableOrName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableOrName: any, data: any) {
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

  async update(tableOrName: any, where: any, data: any) {
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

  async delete(tableOrName: any, where: any) {
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

  async count(tableName: string, where: any = {}) {
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
    return Number(result.total || 0);
  }
}
