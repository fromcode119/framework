import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, like, desc, asc } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { IDatabaseManager, ISchemaCollection, ISchemaField } from '../types';
import { BaseDialect } from './base-dialect';
import { NamingStrategy } from '../naming-strategy';
import { SqliteDateUtils } from './sqlite-date-utils';
import { SqliteColumnNormalizer } from './sqlite-column-normalizer';
import { SqliteSchemaBuilder } from './sqlite-schema-builder';
import { SqliteReadOperations } from './sqlite-read-operations';

export class SqliteDatabaseManager extends BaseDialect implements IDatabaseManager {
  private sqlite: Database.Database;
  public readonly drizzle: any;
  public readonly dialect = 'sqlite' as const;
  private normalizer: SqliteColumnNormalizer;
  private schemaBuilder: SqliteSchemaBuilder;
  private reader: SqliteReadOperations;

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
    this.normalizer = new SqliteColumnNormalizer(this.sqlite);
    this.schemaBuilder = new SqliteSchemaBuilder(this);
    this.reader = new SqliteReadOperations(this.sqlite, this.drizzle, this.normalizer, this.like);
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

  invalidateTableCache(tableName: string): void {
    this.normalizer.invalidateTableCache(tableName);
  }

  private getDynamicTable(tableName: string, columns: string[]) {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = text(NamingStrategy.toSnakeCase(col));
    }
    return sqliteTable(tableName, tableColumns);
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    return this.reader.find(tableOrName, options);
  }

  async findOne(tableOrName: any, where: any): Promise<any | null> {
    const results = await this.find(tableOrName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableOrName: any, data: any): Promise<any> {
    const normalizedData =
      typeof tableOrName === 'string'
        ? await this.normalizer.normalizeDataForTable(tableOrName, data)
        : this.normalizeDataForSchemaObject(data);

    if (typeof tableOrName === 'string') {
      // Use raw SQL so RETURNING * returns ALL columns (including auto-generated id)
      // and so camelCase keys are mapped to snake_case column names
      const cols = Object.keys(normalizedData);
      const colsSql = cols.map((k) => `"${NamingStrategy.toSnakeCase(k)}"`).join(', ');
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((k) => normalizedData[k]);
      const rawSql = `INSERT INTO "${tableOrName}" (${colsSql}) VALUES (${placeholders}) RETURNING *`;
      const result = this.sqlite.prepare(rawSql).get(...values);
      return result || null;
    }

    const [result] = await this.drizzle.insert(tableOrName).values(normalizedData).returning();
    return result;
  }

  async update(tableOrName: any, where: any, data: any): Promise<any> {
    const normalizedData =
      typeof tableOrName === 'string'
        ? await this.normalizer.normalizeDataForTable(tableOrName, data)
        : this.normalizeDataForSchemaObject(data);

    if (typeof tableOrName === 'string') {
      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableOrName, where);
      // Use raw SQL so camelCase keys are converted to snake_case column names
      const setClauses: string[] = [];
      const setValues: any[] = [];
      for (const [k, v] of Object.entries(normalizedData)) {
        setClauses.push(`"${NamingStrategy.toSnakeCase(k)}" = ?`);
        setValues.push(v);
      }
      if (setClauses.length === 0) return null;
      const { sql: whereSql, values: whereValues } = this.buildRawFilterSQL(normalizedWhere);
      const rawSql = `UPDATE "${tableOrName}" SET ${setClauses.join(', ')}${whereSql} RETURNING *`;
      const results = this.sqlite.prepare(rawSql).all(...setValues, ...whereValues);
      return results[0] || null;
    }

    const conditions = this.buildWhereConditions(where);
    const [result] = await this.drizzle.update(tableOrName)
      .set(normalizedData)
      .where(and(...conditions))
      .returning();

    return result;
  }

  async upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any> {
    const normalizedData = this.normalizeDataForSchemaObject(data);
    const normalizedSet = this.normalizeDataForSchemaObject(options.set);
    const query = this.drizzle.insert(tableOrName).values(normalizedData).onConflictDoUpdate({
      target: typeof options.target === 'string' ? (tableOrName as any)[options.target] : options.target,
      set: normalizedSet
    }).returning();
    const [result] = await query;
    return result;
  }

  private normalizeDataForSchemaObject(data: any): any {
    const normalized: any = {};
    for (const [key, value] of Object.entries(data || {})) {
      if (value === undefined) {
        normalized[key] = null;
      } else if (value instanceof Date) {
        normalized[key] = value;
      } else if (typeof value === 'boolean') {
        normalized[key] = value ? 1 : 0;
      } else if (value !== null && typeof value === 'object') {
        normalized[key] = JSON.stringify(value);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  protected override normalizeParamValue(value: any): any {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return SqliteDateUtils.toSafeIsoDate(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  async delete(tableOrName: any, where: any): Promise<boolean> {
    if (typeof tableOrName === 'string') {
      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableOrName, where);
      const { sql: whereSql, values: whereValues } = this.buildRawFilterSQL(normalizedWhere);
      const rawSql = `DELETE FROM "${tableOrName}"${whereSql}`;
      const result = this.sqlite.prepare(rawSql).run(...whereValues);
      return result.changes > 0;
    }

    const isPlainWhere = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    const conditions = this.buildWhereConditions(where);
    let query = this.drizzle.delete(tableOrName);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else if (where && (!isPlainWhere || Object.keys(where).length > 0)) {
      query = query.where(where);
    } else {
      throw new Error('Unsafe delete blocked: missing where clause');
    }
    const result = await query.returning();
    return result.length > 0;
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    return this.reader.count(tableOrName, options);
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
    await this.schemaBuilder.createTable(collection);
  }

  async addColumn(tableName: string, field: ISchemaField): Promise<void> {
    await this.schemaBuilder.addColumn(tableName, field);
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.schemaBuilder.ensureMigrationTable(tableName);
  }

  async resetDatabase(): Promise<void> {
    const tables = await this.getTables();
    for (const table of tables) {
      await this.execute(sql`DROP TABLE ${sql.identifier(table)}`);
    }
  }
}
