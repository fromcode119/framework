import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql, eq, and, count as drizzleCount, desc, asc } from 'drizzle-orm';
import { mysqlTable, text } from 'drizzle-orm/mysql-core';
import { IDatabaseManager, ISchemaCollection, ISchemaField } from '../types';
import { BaseDialect } from './BaseDialect';
import { toSnakeCase } from '../naming';

export class MysqlDatabaseManager extends BaseDialect implements IDatabaseManager {
  private pool: mysql.Pool;
  public readonly drizzle: any;
  public readonly dialect = 'mysql' as const;

  constructor(connection: string) {
    super();
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
        const conditions = this.buildWhereConditions(where);
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      } else {
        query = query.where(where);
      }
    }

    const orderExprs = this.buildOrderBy(orderBy);
    if (orderExprs) {
      query = query.orderBy(...orderExprs);
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
    
    const conditions = this.buildWhereConditions(where);
    
    await this.drizzle
      .update(table)
      .set(data)
      .where(and(...conditions));
    
    return this.findOne(tableName, where);
  }

  async delete(tableName: string, where: any): Promise<boolean> {
    const columns = Object.keys(where);
    const table = this.getDynamicTable(tableName, columns);
    
    const conditions = this.buildWhereConditions(where);
    const [result] = await this.drizzle.delete(table).where(and(...conditions));
    return result.affectedRows > 0;
  }

  async count(tableName: string, where: any = {}): Promise<number> {
    let query = this.drizzle.select({ total: drizzleCount() }).from(sql`${sql.identifier(tableName)}`);
    
    if (where) {
      const isPlainWhere = typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
      if (isPlainWhere) {
        const conditions = this.buildWhereConditions(where);
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      } else {
        query = query.where(where);
      }
    }

    const [result] = await query;
    return Number(result[0]?.total || 0);
  }

  // Schema Management
  async getTables(): Promise<string[]> {
    const [result]: any = await this.execute(sql`SHOW TABLES`);
    return result.map((r: any) => Object.values(r)[0]);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    const [result]: any = await this.execute(query);
    return (result[0]?.total || 0) > 0;
  }

  async getColumns(tableName: string): Promise<string[]> {
    const query = sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName}`;
    const [result]: any = await this.execute(query);
    return result.map((r: any) => r.column_name.toLowerCase());
  }

  async createTable(collection: ISchemaCollection): Promise<void> {
    const tableName = collection.slug;
    const columnDefs: any[] = [];

    columnDefs.push(sql`id INT AUTO_INCREMENT PRIMARY KEY`);
    columnDefs.push(sql`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    columnDefs.push(sql`updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    for (const field of collection.fields) {
      if (field.name === 'id') continue;
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = sql`CREATE TABLE ${sql.identifier(tableName)} (${sql.join(columnDefs, sql`, `)})`;
    await this.execute(query);
  }

  async addColumn(tableName: string, field: ISchemaField): Promise<void> {
    const columnDef = this.fieldToSqlFragment(field);
    await this.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
  }

  async ensureMigrationTable(): Promise<void> {
    await this.execute(sql`
      CREATE TABLE IF NOT EXISTS _system_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version INT NOT NULL,
        batch INT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async resetDatabase(): Promise<void> {
    const tables = await this.getTables();
    await this.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of tables) {
      await this.execute(sql`DROP TABLE ${sql.identifier(table)}`);
    }
    await this.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  }

  private fieldToSqlFragment(field: ISchemaField): any {
    const dbName = toSnakeCase(field.name);
    let type = sql`TEXT`;
    
    switch (field.type) {
      case 'number': type = sql`NUMERIC`; break;
      case 'boolean': type = sql`BOOLEAN`; break;
      case 'date': type = sql`DATETIME`; break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        type = sql`JSON`;
        break;
      case 'textarea':
      case 'text':
      case 'select':
      default:
        type = sql`TEXT`;
    }

    const constraints: any[] = [];
    if (field.required) constraints.push(sql`NOT NULL`);
    if (field.unique) constraints.push(sql`UNIQUE`);
    
    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        constraints.push(sql.raw(`DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`));
      } else if (typeof field.defaultValue === 'boolean') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue ? 'true' : 'false'}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    return sql`${sql.identifier(dbName)} ${type} ${sql.join(constraints, sql` `)}`;
  }
}
