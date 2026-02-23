import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, and, or, like, desc, asc } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { IDatabaseManager, ISchemaCollection, ISchemaField } from '../types';
import { BaseDialect } from './base-dialect';
import { toSnakeCase } from '../naming-strategy';

export class SqliteDatabaseManager extends BaseDialect implements IDatabaseManager {
  private sqlite: Database.Database;
  public readonly drizzle: any;
  public readonly dialect = 'sqlite' as const;

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
      tableColumns[col] = text(toSnakeCase(col));
    }
    return sqliteTable(tableName, tableColumns);
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;

      if (joins && joins.length > 0) {
        const { sql: sqlStr, values } = this.buildJoinedSQL(tableName, joins, options);
        const rows = await this.executeRawSelect(sqlStr, values);
        return this.processJoinedRows(rows, joins);
      }

      // Build SELECT column list
      let columnPart = '*';
      if (columns && Object.keys(columns).length > 0) {
        const selected = Object.entries(columns)
          .filter(([, v]) => v)
          .map(([k]) => `"${k}"`);
        if (selected.length > 0) columnPart = selected.join(', ');
      }

      // Use raw SQL for dynamic table names — drizzle.select() without args produces
      // an empty column list ("select  from …") which SQLite rejects
      const searchArg = (search && search.columns?.length > 0 && search.value) ? search : undefined;
      const { sql: whereSql, values } = this.buildRawFilterSQL(where, searchArg);
      let sqlStr = `SELECT ${columnPart} FROM "${tableName}"${whereSql}`;
      if (orderBy) sqlStr += this.buildRawOrderByClause(orderBy);
      if (limit) sqlStr += ` LIMIT ${limit}`;
      if (offset) sqlStr += ` OFFSET ${offset}`;

      return this.executeRawSelect(sqlStr, values);
    }

    // tableOrName is a Drizzle table schema object
    let query = this.drizzle.select().from(tableOrName);

    const allConditions: any[] = [];
    if (where) {
      if (typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
        allConditions.push(...this.buildWhereConditions(where));
      } else {
        allConditions.push(where);
      }
    }
    if (search && search.columns.length > 0 && search.value) {
      const pattern = `%${search.value}%`;
      const likeConditions = search.columns.map((col: string) => like(sql`${sql.identifier(col)}`, pattern));
      allConditions.push(likeConditions.length === 1 ? likeConditions[0] : or(...likeConditions));
    }
    if (allConditions.length > 0) {
      query = query.where(and(...allConditions));
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

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    return this.sqlite.prepare(sqlStr).all(...values);
  }

  async insert(tableOrName: any, data: any): Promise<any> {
    const normalizedData = this.normalizeData(data);

    if (typeof tableOrName === 'string') {
      // Use raw SQL so RETURNING * returns ALL columns (including auto-generated id)
      // and so camelCase keys are mapped to snake_case column names
      const cols = Object.keys(normalizedData);
      const colsSql = cols.map((k) => `"${toSnakeCase(k)}"`).join(', ');
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
    const normalizedData = this.normalizeData(data);

    if (typeof tableOrName === 'string') {
      // Use raw SQL so camelCase keys are converted to snake_case column names
      const setClauses: string[] = [];
      const setValues: any[] = [];
      for (const [k, v] of Object.entries(normalizedData)) {
        setClauses.push(`"${toSnakeCase(k)}" = ?`);
        setValues.push(v);
      }
      if (setClauses.length === 0) return null;
      const { sql: whereSql, values: whereValues } = this.buildRawFilterSQL(where);
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

  private normalizeData(data: any): any {
    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        normalized[key] = null;
      } else if (value instanceof Date) {
        normalized[key] = value.toISOString();
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
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  async delete(tableOrName: any, where: any): Promise<boolean> {
    if (typeof tableOrName === 'string') {
      const { sql: whereSql, values: whereValues } = this.buildRawFilterSQL(where);
      const rawSql = `DELETE FROM "${tableOrName}"${whereSql}`;
      const result = this.sqlite.prepare(rawSql).run(...whereValues);
      return result.changes > 0;
    }

    const conditions = this.buildWhereConditions(where);
    const result = await this.drizzle.delete(tableOrName).where(and(...conditions)).returning();
    return result.length > 0;
  }

  async count(tableName: string, where: any = {}): Promise<number> {
    const isPlainWhere = where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    if (isPlainWhere && Object.keys(where).length > 0) {
      const { sql: whereSql, values } = this.buildRawFilterSQL(where);
      const rawSql = `SELECT COUNT(*) as total FROM "${tableName}"${whereSql}`;
      const result = this.sqlite.prepare(rawSql).get(...values) as any;
      return Number(result?.total || 0);
    }

    const rawSql = `SELECT COUNT(*) as total FROM "${tableName}"`;
    const result = this.sqlite.prepare(rawSql).get() as any;
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

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
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
