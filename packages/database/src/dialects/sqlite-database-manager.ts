import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, like, count as drizzleCount, desc, asc } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { IDatabaseManager, ISchemaCollection, ISchemaField } from '../types';
import { BaseDialect } from './base-dialect';
import { NamingStrategy } from '../naming-strategy';
import { SqliteDateUtils } from './sqlite-date-utils';

export class SqliteDatabaseManager extends BaseDialect implements IDatabaseManager {
  private sqlite: Database.Database;
  public readonly drizzle: any;
  public readonly dialect = 'sqlite' as const;
  private jsonColumnsCache = new Map<string, Set<string>>();

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
      tableColumns[col] = text(NamingStrategy.toSnakeCase(col));
    }
    return sqliteTable(tableName, tableColumns);
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const normalizedWhere = await this.normalizeWhereForTable(tableName, where);

      if (joins && joins.length > 0) {
        const { sql: sqlStr, values } = this.buildJoinedSQL(tableName, joins, { ...options, where: normalizedWhere });
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
      const { sql: whereSql, values } = this.buildRawFilterSQL(normalizedWhere, searchArg);
      let sqlStr = `SELECT ${columnPart} FROM "${tableName}"${whereSql}`;
      if (orderBy) sqlStr += this.buildRawOrderByClause(orderBy);
      if (limit) sqlStr += ` LIMIT ${limit}`;
      if (offset) sqlStr += ` OFFSET ${offset}`;

      return this.executeRawSelect(sqlStr, values);
    }

    // tableOrName is a Drizzle table schema object
    let query: any;
    
    if (columns && Object.keys(columns).length > 0) {
      const selection: Record<string, any> = {};
      for (const [key, val] of Object.entries(columns)) {
        if (val) selection[key] = (tableOrName as any)[key];
      }
      query = this.drizzle.select(selection).from(tableOrName);
    } else {
      query = this.drizzle.select().from(tableOrName);
    }

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

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
      const likeConditions = search.columns.map((col: string) => {
          const colObj = typeof tableOrName[col] !== 'undefined' ? tableOrName[col] : sql`${sql.identifier(col)}`;
          return this.like(colObj, pattern);
      });
      allConditions.push(likeConditions.length === 1 ? likeConditions[0] : or(...likeConditions));
    }
    if (allConditions.length > 0) {
      query = query.where(and(...allConditions));
    }

    const orderExprs = this.buildOrderBy(orderBy);
    if (orderExprs) {
      query = query.orderBy(...(Array.isArray(orderExprs) ? orderExprs : [orderExprs]));
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
    const normalizedData =
      typeof tableOrName === 'string'
        ? await this.normalizeDataForTable(tableOrName, data)
        : this.normalizeData(data);

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
        ? await this.normalizeDataForTable(tableOrName, data)
        : this.normalizeData(data);

    if (typeof tableOrName === 'string') {
      const normalizedWhere = await this.normalizeWhereForTable(tableOrName, where);
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
    const normalizedData = this.normalizeData(data);
    const normalizedSet = this.normalizeData(options.set);
    const query = this.drizzle.insert(tableOrName).values(normalizedData).onConflictDoUpdate({
      target: typeof options.target === 'string' ? (tableOrName as any)[options.target] : options.target,
      set: normalizedSet
    }).returning();
    const [result] = await query;
    return result;
  }



  private normalizeData(data: any): any {
    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        normalized[key] = null;
      } else if (value instanceof Date) {
        normalized[key] = SqliteDateUtils.toSafeIsoDate(value);
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
      const normalizedWhere = await this.normalizeWhereForTable(tableOrName, where);
      const { sql: whereSql, values: whereValues } = this.buildRawFilterSQL(normalizedWhere);
      const rawSql = `DELETE FROM "${tableOrName}"${whereSql}`;
      const result = this.sqlite.prepare(rawSql).run(...whereValues);
      return result.changes > 0;
    }

    const conditions = this.buildWhereConditions(where);
    const result = await this.drizzle.delete(tableOrName).where(and(...conditions)).returning();
    return result.length > 0;
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins } = options;
    const isString = typeof tableOrName === 'string';
    const tableIdentifier = isString ? sql`${sql.identifier(tableOrName)}` : tableOrName;
    const normalizedWhere = isString ? await this.normalizeWhereForTable(tableOrName, where) : where;
    
    // Check if we can use simple raw SQL for performance
    const isPlainWhere = normalizedWhere && typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype;
    const hasJoins = joins && joins.length > 0;

    if (isString && !hasJoins) {
      if (isPlainWhere && Object.keys(normalizedWhere).length > 0) {
        const { sql: whereSql, values } = this.buildRawFilterSQL(normalizedWhere);
        const rawSql = `SELECT COUNT(*) as total FROM "${tableOrName}"${whereSql}`;
        const result = this.sqlite.prepare(rawSql).get(...values) as any;
        return Number(result?.total || 0);
      }
      const rawSql = `SELECT COUNT(*) as total FROM "${tableOrName}"`;
      const result = this.sqlite.prepare(rawSql).get() as any;
      return Number(result?.total || 0);
    }

    // Use Drizzle for complex counts
    let query = this.drizzle.select({ total: drizzleCount() }).from(tableIdentifier);

    if (hasJoins) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const conditions: any[] = [];
    if (normalizedWhere) {
      if (isPlainWhere) {
        conditions.push(...this.buildWhereConditions(normalizedWhere));
      } else {
        conditions.push(normalizedWhere);
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
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
    const fieldSnakeNames = collection.fields.map(f => NamingStrategy.toSnakeCase(f.name));

    if (!fieldSnakeNames.includes('id')) {
      columnDefs.push(sql`id INTEGER PRIMARY KEY AUTOINCREMENT`);
    }
    if (!fieldSnakeNames.includes('created_at')) {
      columnDefs.push(sql`created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }
    if (!fieldSnakeNames.includes('updated_at')) {
      columnDefs.push(sql`updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    for (const field of collection.fields) {
      if (field.name === 'id' && !fieldSnakeNames.includes('id')) continue;
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = sql`CREATE TABLE ${sql.identifier(tableName)} (${sql.join(columnDefs, sql`, `)})`;
    await this.execute(query);
    this.jsonColumnsCache.delete(tableName);
  }

  async addColumn(tableName: string, field: ISchemaField): Promise<void> {
    const columnDef = this.fieldToSqlFragment(field, { includeUnique: false });
    await this.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
    if (field.unique) {
      await this.createUniqueIndex(tableName, NamingStrategy.toSnakeCase(field.name));
    }
    this.jsonColumnsCache.delete(tableName);
  }

  private async createUniqueIndex(tableName: string, columnName: string): Promise<void> {
    const indexName = `${tableName}_${columnName}_unique_idx`
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_');

    await this.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(indexName)} ON ${sql.identifier(tableName)} (${sql.identifier(columnName)})`
    );
  }

  private async getJsonColumns(tableName: string): Promise<Set<string>> {
    const cached = this.jsonColumnsCache.get(tableName);
    if (cached) return cached;

    const rows = this.sqlite.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all() as any[];
    const columns = new Set(
      (rows || [])
        .filter((row: any) => String(row?.type || '').toUpperCase().includes('JSON'))
        .map((row: any) => String(row?.name || '').toLowerCase())
    );
    this.jsonColumnsCache.set(tableName, columns);
    return columns;
  }

  private normalizeJsonColumnValue(value: any): any {
    if (value === undefined || value === null) return null;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return JSON.stringify(value);
      try {
        JSON.parse(trimmed);
        return trimmed;
      } catch {
        return JSON.stringify(value);
      }
    }

    return JSON.stringify(value);
  }

  private async normalizeColumnValueForWrite(tableName: string, column: string, value: any): Promise<any> {
    const jsonColumns = await this.getJsonColumns(tableName);
    const normalizedColumn = NamingStrategy.toSnakeCase(column).toLowerCase();
    if (jsonColumns.has(normalizedColumn)) {
      return this.normalizeJsonColumnValue(value);
    }
    return this.normalizeParamValue(value);
  }

  private async normalizeDataForTable(tableName: string, data: any): Promise<any> {
    const normalized: any = {};
    for (const [column, value] of Object.entries(data || {})) {
      normalized[column] = await this.normalizeColumnValueForWrite(tableName, column, value);
    }
    return normalized;
  }

  private async normalizeWhereForTable(tableName: string, where: any): Promise<any> {
    if (!where || typeof where !== 'object' || Object.getPrototypeOf(where) !== Object.prototype) {
      return where;
    }
    const normalized: any = {};
    for (const [column, value] of Object.entries(where)) {
      normalized[column] = await this.normalizeColumnValueForWrite(tableName, column, value);
    }
    return normalized;
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

  private fieldToSqlFragment(field: ISchemaField, options: { includeUnique?: boolean } = {}): any {
    const dbName = NamingStrategy.toSnakeCase(field.name);
    const includeUnique = options.includeUnique !== false;
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
    if (includeUnique && field.unique) constraints.push(sql`UNIQUE`);
    
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