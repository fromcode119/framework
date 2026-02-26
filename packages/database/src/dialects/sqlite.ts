import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, like, count as drizzleCount, desc, asc } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { IDatabaseManager, ISchemaCollection, ISchemaField } from '../types';
import { BaseDialect } from './base-dialect';
import { toSnakeCase } from '../naming-strategy';

export class SqliteDatabaseManager extends BaseDialect implements IDatabaseManager {
  private sqlite: Database.Database;
  public readonly drizzle: any;
  public readonly dialect = 'sqlite' as const;

  // Standard operators
  public readonly like = like;
  public readonly eq = eq;
  public readonly ne = ne;
  public readonly and = and;
  public readonly or = or;
  public readonly isNull = isNull;
  public readonly isNotNull = isNotNull;
  public readonly inArray = inArray;
  public readonly desc = desc;
  public readonly asc = asc;

  constructor(connection: string) {
    super();
    const dbPath = connection.startsWith('sqlite:')
      ? connection.replace('sqlite:', '')
      : connection.startsWith('file:')
        ? connection.replace('file:', '')
        : connection;
    this.sqlite = new Database(dbPath);
    this.drizzle = drizzle(this.sqlite);
  }

  async connect() {
    // SQLite is synchronous and connects immediately
  }

  async execute(query: any) {
    if (typeof query === 'string') {
      return this.sqlite.exec(query);
    }
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

    return await query;
  }

  async findOne(tableOrName: any, where: any): Promise<any | null> {
    const results = await this.find(tableOrName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableOrName: any, data: any): Promise<any> {
    let table;
    const normalizedData = this.normalizeData(data);
    if (typeof tableOrName === 'string') {
      const columns = Object.keys(normalizedData);
      table = this.getDynamicTable(tableOrName, columns);
    } else {
      table = tableOrName;
    }
    const [result] = await this.drizzle.insert(table).values(normalizedData).returning();
    return result;
  }

  async update(tableOrName: any, where: any, data: any): Promise<any> {
    let table;
    const normalizedData = this.normalizeData(data);
    if (typeof tableOrName === 'string') {
      const allColumns = [...new Set([...Object.keys(where), ...Object.keys(normalizedData)])];
      table = this.getDynamicTable(tableOrName, allColumns);
    } else {
      table = tableOrName;
    }
    
    const conditions = this.buildWhereConditions(where);
    
    const [result] = await this.drizzle.update(table)
      .set(normalizedData)
      .where(and(...conditions))
      .returning();
    
    return result;
  }

  private normalizeData(data: any): any {
    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        normalized[key] = JSON.stringify(value);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  async delete(tableOrName: any, where: any): Promise<boolean> {
    let table;
    if (typeof tableOrName === 'string') {
      const columns = Object.keys(where);
      table = this.getDynamicTable(tableOrName, columns);
    } else {
      table = tableOrName;
    }
    
    const conditions = this.buildWhereConditions(where);
    const result = await this.drizzle.delete(table).where(and(...conditions)).returning();
    return result.length > 0;
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
    return Number(result?.total || 0);
  }

  // Schema Management
  async getTables(): Promise<string[]> {
    const result: any = await this.drizzle.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
    return result.map((r: any) => r.name);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = sql`SELECT count(*) as total FROM sqlite_master WHERE type='table' AND name=${tableName}`;
    const result: any = await this.drizzle.all(query);
    return (result[0]?.total || 0) > 0;
  }

  async getColumns(tableName: string): Promise<string[]> {
    const result: any = await this.drizzle.all(sql`PRAGMA table_info(${sql.identifier(tableName)})`);
    return result.map((r: any) => r.name.toLowerCase());
  }

  async createTable(collection: ISchemaCollection): Promise<void> {
    const tableName = collection.slug;
    const columnDefs: any[] = [];

    columnDefs.push(sql`id INTEGER PRIMARY KEY AUTOINCREMENT`);
    columnDefs.push(sql`created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    columnDefs.push(sql`updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);

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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        batch INTEGER NOT NULL,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async resetDatabase(): Promise<void> {
    const tables = await this.getTables();
    for (const table of tables) {
      await this.execute(sql`DROP TABLE ${sql.identifier(table)}`);
    }
  }

  private fieldToSqlFragment(field: ISchemaField): any {
    const dbName = toSnakeCase(field.name);
    let type = sql`TEXT`;
    
    switch (field.type) {
      case 'number': type = sql`REAL`; break;
      case 'boolean': type = sql`INTEGER`; break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
      case 'textarea':
      case 'text':
      case 'select':
      case 'date':
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
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue ? 1 : 0}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    return sql`${sql.identifier(dbName)} ${type} ${sql.join(constraints, sql` `)}`;
  }
}
