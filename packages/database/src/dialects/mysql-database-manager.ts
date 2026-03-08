import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, like, count as drizzleCount, desc, asc } from 'drizzle-orm';
import { mysqlTable, text } from 'drizzle-orm/mysql-core';
import { IDatabaseManager, ISchemaCollection, ISchemaField } from '../types';
import { BaseDialect } from './base-dialect';
import { toSnakeCase } from '../naming-strategy';

export class MysqlDatabaseManager extends BaseDialect implements IDatabaseManager {
  private pool: mysql.Pool;
  public readonly drizzle: any;
  public readonly dialect = 'mysql' as const;
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

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    if (typeof tableOrName === 'string') {
        const normalizedWhere = await this.normalizeWhereForTable(tableOrName, where);
        if (joins && joins.length > 0) {
        const { sql: sqlStr, values } = this.buildJoinedSQL(tableOrName, joins, { ...options, where: normalizedWhere });
        const rows = await this.executeRawSelect(sqlStr, values);
        return this.processJoinedRows(rows, joins);
        }
        
        let query;
        if (columns && Object.keys(columns).length > 0) {
        const selectFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(columns)) {
            if (value) {
            selectFields[key] = sql`${sql.identifier(key)}`;
            }
        }
        query = this.drizzle.select(selectFields).from(sql`${sql.identifier(tableOrName)}`);
        } else {
        query = this.drizzle.select().from(sql`${sql.identifier(tableOrName)}`);
        }

        const allConditions: any[] = [];
        if (normalizedWhere) {
        if (typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype) {
            allConditions.push(...this.buildWhereConditions(normalizedWhere));
        } else {
            allConditions.push(normalizedWhere);
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
        query = query.orderBy(...(Array.isArray(orderExprs) ? orderExprs : [orderExprs]));
        }

        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);

        const [rows] = await query;
        return rows || [];
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

    const [results] = await query;
    return results;
  }

  async findOne(tableName: string, where: any): Promise<any | null> {
    const results = await this.find(tableName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableName: string, data: any): Promise<any> {
    const normalizedData = await this.normalizeDataForTable(tableName, data);
    const columns = Object.keys(normalizedData);
    const table = this.getDynamicTable(tableName, columns);
    const [result] = await this.drizzle.insert(table).values(normalizedData);
    
    // MySQL insert doesn't return the row with .returning() usually (depends on driver/version)
    // For now, return what we have or try to fetch it if needed.
    // In many cases, result.insertId is useful.
    return { ...normalizedData, id: result.insertId };
  }

  async update(tableName: string, where: any, data: any): Promise<any> {
    const normalizedData = await this.normalizeDataForTable(tableName, data);
    const normalizedWhere = await this.normalizeWhereForTable(tableName, where);
    const allColumns = [...new Set([...Object.keys(normalizedWhere || {}), ...Object.keys(normalizedData)])];
    const table = this.getDynamicTable(tableName, allColumns);
    
    const conditions = this.buildWhereConditions(normalizedWhere);
    
    await this.drizzle
      .update(table)
      .set(normalizedData)
      .where(and(...conditions));
    
    return this.findOne(tableName, normalizedWhere);
  }

  async upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any> {
    // MySQL Drizzle uses onDuplicateKeyUpdate
    const query = this.drizzle.insert(tableOrName).values(data).onDuplicateKeyUpdate({
      set: options.set
    });
    const [result] = await query;
    return { ...data, id: result.insertId };
  }

  async delete(tableName: string, where: any): Promise<boolean> {
    const normalizedWhere = await this.normalizeWhereForTable(tableName, where);
    const columns = Object.keys(normalizedWhere || {});
    const table = this.getDynamicTable(tableName, columns);
    
    const conditions = this.buildWhereConditions(normalizedWhere);
    const [result] = await this.drizzle.delete(table).where(and(...conditions));
    return result.affectedRows > 0;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const [rows] = await this.pool.execute(sqlStr, values);
    return rows as any[];
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins } = options;
    const isString = typeof tableOrName === 'string';
    const tableIdentifier = isString ? sql`${sql.identifier(tableOrName)}` : tableOrName;
    const normalizedWhere = isString ? await this.normalizeWhereForTable(tableOrName, where) : where;
    
    let query = this.drizzle.select({ total: drizzleCount() }).from(tableIdentifier);

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const conditions: any[] = [];
    if (normalizedWhere) {
      if (typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype) {
        conditions.push(...this.buildWhereConditions(normalizedWhere));
      } else {
        conditions.push(normalizedWhere);
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
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
    const fieldSnakeNames = collection.fields.map(f => toSnakeCase(f.name));

    if (!fieldSnakeNames.includes('id')) {
      columnDefs.push(sql`id INT AUTO_INCREMENT PRIMARY KEY`);
    }

    if (!fieldSnakeNames.includes('created_at')) {
      columnDefs.push(sql`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }

    if (!fieldSnakeNames.includes('updated_at')) {
      columnDefs.push(sql`updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
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
    const columnDef = this.fieldToSqlFragment(field);
    await this.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
    this.jsonColumnsCache.delete(tableName);
  }

  private async getJsonColumns(tableName: string): Promise<Set<string>> {
    const cached = this.jsonColumnsCache.get(tableName);
    if (cached) return cached;

    const [rows]: any = await this.pool.execute(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND data_type = 'json'`,
      [tableName]
    );
    const columns: Set<string> = new Set<string>(
      (rows || []).map((row: any) => String(row?.column_name || '').toLowerCase())
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
    const normalizedColumn = toSnakeCase(column).toLowerCase();
    if (jsonColumns.has(normalizedColumn)) {
      return this.normalizeJsonColumnValue(value);
    }
    return this.normalizeParamValue(value);
  }

  private async normalizeDataForTable(tableName: string, data: any): Promise<any> {
    const normalized: Record<string, any> = {};
    for (const [column, value] of Object.entries(data || {})) {
      normalized[column] = await this.normalizeColumnValueForWrite(tableName, column, value);
    }
    return normalized;
  }

  private async normalizeWhereForTable(tableName: string, where: any): Promise<any> {
    if (!where || typeof where !== 'object' || Object.getPrototypeOf(where) !== Object.prototype) {
      return where;
    }
    const normalized: Record<string, any> = {};
    for (const [column, value] of Object.entries(where)) {
      normalized[column] = await this.normalizeColumnValueForWrite(tableName, column, value);
    }
    return normalized;
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
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
