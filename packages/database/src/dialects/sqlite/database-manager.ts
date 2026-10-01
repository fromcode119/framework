import { PortableSchemaOperations } from '@database/dialects/portable-schema-operations';
import type { IIndexColumn } from '@database/interfaces/index-column.interface';
import type { IAggregateOptions } from '@database/interfaces/aggregate-options.interface';
import Database from 'better-sqlite3';
import { Sql } from '@database/sql/sql';
import { SqlColumns } from '@database/sql/sql-columns';
import { SqlTable } from '@database/sql/sql-table';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import { SqliteTableStatements } from '@database/dialects/sqlite/sqlite-table-statements';
import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import { BaseDialect } from '@database/dialects/base-dialect';
import { NamingStrategy } from '@database/naming-strategy';
import { SqliteDateUtils } from '@database/dialects/sqlite/date-utils';
import { SqliteColumnNormalizer } from '@database/dialects/sqlite/column-normalizer';
import { SqliteSchemaBuilder } from '@database/dialects/sqlite/schema-builder';
import { SqliteReadOperations } from '@database/dialects/sqlite/read-operations';

export class SqliteDatabaseManager extends BaseDialect implements IDatabaseManager {
  private sqlite: Database.Database;
  public readonly dialect = 'sqlite' as const;
  private statements: SqliteTableStatements;
  private normalizer: SqliteColumnNormalizer;
  private schemaBuilder: SqliteSchemaBuilder;
  private reader: SqliteReadOperations;

  // Standard operators
  public readonly like = Sql.like;
  public readonly eq = Sql.eq;
  public readonly ne = Sql.ne;
  public readonly and = Sql.and;
  public readonly or = Sql.or;
  public readonly isNull = Sql.isNull;
  public readonly isNotNull = Sql.isNotNull;
  public readonly inArray = Sql.inArray;
  public readonly desc = Sql.desc;
  public readonly asc = Sql.asc;

  constructor(connection: string) {
    super();
    const stripped = connection.startsWith('sqlite:')
      ? connection.replace('sqlite:', '')
      : connection.startsWith('file:')
        ? connection.replace('file:', '')
        : connection;
    // `sqlite:/path/app.db?mode=ro` opens the file READ-ONLY. The tenant-migration CLI reads a live
    // single-tenant database this way: a real client's data, never to be written by an export.
    const queryIndex = stripped.indexOf('?');
    const dbPath = queryIndex >= 0 ? stripped.slice(0, queryIndex) : stripped;
    const params = new URLSearchParams(queryIndex >= 0 ? stripped.slice(queryIndex + 1) : '');
    const readonly = params.get('mode') === 'ro';
    this.sqlite = new Database(dbPath, readonly ? { readonly: true, fileMustExist: true } : {});
    this.statements = new SqliteTableStatements(this.sqlite);
    this.normalizer = new SqliteColumnNormalizer(this.sqlite);
    this.schemaBuilder = new SqliteSchemaBuilder(this);
    this.reader = new SqliteReadOperations(this.sqlite, this.statements, this.normalizer, this.like);
  }

  async connect() {
    // SQLite is synchronous and connects immediately
  }

  async execute(query: any) {
    if (typeof query === 'string') {
      return this.sqlite.exec(query);
    }
    return this.statements.run(query);
  }

  /**
   * `BEGIN IMMEDIATE` takes SQLite's write lock at once rather than on the first write, so a second
   * caller blocks here instead of getting as far as reading, deciding, and then colliding. SQLite has
   * exactly one writer, which is what makes that sufficient — there is no advisory lock to name, and
   * the name is kept only so the failure message can say what was being guarded.
   */
  async withExclusiveLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
    await this.queryRaw('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      await this.queryRaw('COMMIT');
      return result;
    } catch (error) {
      await this.queryRaw('ROLLBACK').catch(() => undefined);
      throw new Error(`Exclusive section "${name}" failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async queryRaw(sqlText: string, values: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    const statement = this.sqlite.prepare(sqlText);
    if (!statement.reader) {
      statement.run(...(values as any[]));
      return [];
    }
    return statement.all(...(values as any[])) as Array<Record<string, unknown>>;
  }

  invalidateTableCache(tableName: string): void {
    this.normalizer.invalidateTableCache(tableName);
  }

  private getDynamicTable(tableName: string, columns: string[]) {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = SqlColumns.text(NamingStrategy.toSnakeCase(col));
    }
    return SqlTable.define(tableName, tableColumns);
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

    const [result] = this.statements.write(tableOrName, this.statements.writes.insertStatement(tableOrName, normalizedData));
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

    // With no filter this used to run with NO where — every row rewritten. Refused, as a delete is.
    const filter = SqlTableReads.filter(this.buildWhereConditions(where, tableOrName), where);
    const [result] = this.statements.write(tableOrName, this.statements.writes.updateStatement(tableOrName, normalizedData, filter));
    return result;
  }

  async upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any> {
    const normalizedData = this.normalizeDataForSchemaObject(data);
    const normalizedSet = this.normalizeDataForSchemaObject(options.set);
    const target = typeof options.target === 'string' ? (tableOrName as any)[options.target] : options.target;
    const [result] = this.statements.write(tableOrName, this.statements.writes.upsertStatement(tableOrName, normalizedData, target, normalizedSet));
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

    const filter = SqlTableReads.filter(this.buildWhereConditions(where, tableOrName), where);
    return this.statements.write(tableOrName, this.statements.writes.deleteStatement(tableOrName, filter)).length > 0;
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    return this.reader.count(tableOrName, options);
  }

  /** COUNT(*) per group — SQL aggregation, so analytics never page rows into memory to count them. */
  async aggregate(tableName: string, options: IAggregateOptions): Promise<Array<Record<string, unknown>>> {
    return this.reader.aggregate(tableName, options);
  }

  async groupCount(
    tableName: string,
    options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number },
  ): Promise<Array<Record<string, unknown>>> {
    return this.reader.groupCount(tableName, options);
  }

  // Schema Management
  async getTables(): Promise<string[]> {
    const result: any = this.statements.all(Sql.query`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
    return result.map((r: any) => r.name);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result: any = this.statements.all(Sql.query`SELECT count(*) as total FROM sqlite_master WHERE type='table' AND name=${tableName}`);
    return (result[0]?.total || 0) > 0;
  }

  async getColumns(tableName: string): Promise<string[]> {
    const result: any = this.statements.all(Sql.query`PRAGMA table_info(${Sql.identifier(tableName)})`);
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
      await this.execute(Sql.query`DROP TABLE ${Sql.identifier(table)}`);
    }
  }

  /** Validated schema statements a migration would otherwise hand-write — see PortableSchemaOperations. */
  private readonly portableSchema = new PortableSchemaOperations((statement) => this.execute(statement));
  async createIndexIfMissing(table: string, indexName: string, columns: Array<string | IIndexColumn>, options?: { unique?: boolean }): Promise<void> {
    return this.portableSchema.createIndexIfMissing(table, indexName, columns, options);
  }
  async dropTableIfExists(table: string): Promise<void> { return this.portableSchema.dropTableIfExists(table); }
  async dropColumnIfExists(table: string, column: string): Promise<void> { return this.portableSchema.dropColumnIfExists(table, column); }
  async copyColumnValues(table: string, target: string, source: string, jsonKey?: string): Promise<void> {
    return this.portableSchema.copyColumnValues(table, target, source, jsonKey);
  }
}
