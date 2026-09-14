import { DatabaseRoleOutcome } from '@database/roles/database-role-outcome';
import type { DatabaseRolePlan } from '@database/roles/database-role-plan';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, like, desc, asc } from 'drizzle-orm';
import { mysqlTable, text } from 'drizzle-orm/mysql-core';
import { NamingStrategy } from '@database/naming-strategy';
import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import { BaseDialect } from '@database/dialects/base-dialect';
import { MysqlColumnNormalizer } from '@database/dialects/mysql/column-normalizer';
import { MysqlSchemaBuilder } from '@database/dialects/mysql/schema-builder';
import { MysqlReadOperations } from '@database/dialects/mysql/read-operations';

export class MysqlDatabaseManager extends BaseDialect implements IDatabaseManager {
  private pool: mysql.Pool;
  public readonly drizzle: any;
  public readonly dialect = 'mysql' as const;
  private normalizer: MysqlColumnNormalizer;
  private schemaBuilder: MysqlSchemaBuilder;
  private reader: MysqlReadOperations;

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
    // ANSI_QUOTES, and it is what makes shared SQL work here at all.
    //
    // MySQL's default mode reads `"users"` as the STRING 'users', not as an identifier — so every
    // migration written with double-quoted identifiers, which is all of them, parses as nonsense and
    // fails in ways that name a syntax error rather than the mode. With ANSI_QUOTES it agrees with
    // PostgreSQL and SQLite about what a quoted name is.
    //
    // Appended to the session mode rather than replacing it: `sql_mode` also carries the strictness
    // settings a deployment chose, and overwriting them would quietly relax constraints this schema
    // depends on.
    this.pool = mysql.createPool(connection);
    MysqlDatabaseManager.applyAnsiQuotes(this.pool);
    this.drizzle = drizzle(this.pool);
    this.normalizer = new MysqlColumnNormalizer(this.pool);
    this.schemaBuilder = new MysqlSchemaBuilder(this);
    this.reader = new MysqlReadOperations(this.pool, this.drizzle, this.normalizer, this.like);
  }

  /**
   * Set `ANSI_QUOTES` on every connection the pool opens.
   *
   * It has to be per CONNECTION, not once: a pool opens more as load requires and replaces ones that
   * drop, and a session variable set on one says nothing about the next. Setting it in the connection
   * string does not work either — `sql_mode` is a server variable, not one of mysql2's connect
   * options, so it is accepted and ignored, which looks like it worked right up until the first
   * quoted identifier.
   *
   * `CONCAT(@@sql_mode, ...)` rather than an assignment: sql_mode also carries the strictness
   * settings a deployment chose, and replacing them would quietly relax constraints this schema
   * depends on.
   */
  private static applyAnsiQuotes(pool: any): void {
    pool.on('connection', (connection: any) => {
      connection.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')");
    });
  }

  async connect() {
    await this.pool.getConnection();
  }

  /**
   * A named lock held for the length of the transaction. MySQL's `GET_LOCK` is connection-scoped rather
   * than transaction-scoped, so it is released explicitly on every path — including the failure one,
   * or the next caller would wait for a lock nobody still needs.
   */
  async withExclusiveLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const acquired = await this.queryRaw('SELECT GET_LOCK(?, ?) AS acquired', [name, MysqlDatabaseManager.LOCK_TIMEOUT_SECONDS]);
    if (Number(acquired?.[0]?.acquired) !== 1) {
      throw new Error(`Could not acquire the exclusive lock "${name}" within ${MysqlDatabaseManager.LOCK_TIMEOUT_SECONDS}s.`);
    }
    await this.queryRaw('START TRANSACTION');
    try {
      const result = await fn();
      await this.queryRaw('COMMIT');
      return result;
    } catch (error) {
      await this.queryRaw('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await this.queryRaw('SELECT RELEASE_LOCK(?)', [name]).catch(() => undefined);
    }
  }

  /** Long enough for a slow first-admin insert, short enough that a stuck caller surfaces as an error. */
  private static readonly LOCK_TIMEOUT_SECONDS = 10;

  /**
   * Creates or realigns the deployment's logins.
   *
   * MySQL does not accept placeholders in DDL, so every name and password is quoted here instead of
   * being bound — a user name is a string literal in `CREATE USER`, a schema is a backtick identifier
   * in `GRANT`, and the two escape differently.
   *
   * The runtime role gets DML only, never DDL: it must not be able to alter the schema it serves. Note
   * that MySQL has no row-level security, so `supportsTenantIsolation()` is false and a multi-tenant
   * deployment on this driver is refused before it boots — these roles are least privilege, not
   * isolation.
   */
  async provisionRoles(plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome> {
    const schema = MysqlDatabaseManager.quoteIdentifier(plan.database);
    const roles = plan.isSingleRole ? [plan.owner] : [plan.owner, plan.runtime];

    for (const role of roles) {
      const user = `${MysqlDatabaseManager.quoteLiteral(role.name)}@'%'`;
      const password = MysqlDatabaseManager.quoteLiteral(role.password);
      await this.queryRaw(`CREATE USER IF NOT EXISTS ${user} IDENTIFIED BY ${password}`);
      await this.queryRaw(`ALTER USER ${user} IDENTIFIED BY ${password}`);
    }

    await this.queryRaw(`GRANT ALL PRIVILEGES ON ${schema}.* TO ${MysqlDatabaseManager.quoteLiteral(plan.owner.name)}@'%'`);
    if (!plan.isSingleRole) {
      await this.queryRaw(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ${schema}.* TO ${MysqlDatabaseManager.quoteLiteral(plan.runtime.name)}@'%'`,
      );
    }
    await this.queryRaw('FLUSH PRIVILEGES');

    return DatabaseRoleOutcome.applied(roles.map(role => role.name));
  }

  /** A string literal: doubles quotes and escapes backslashes, which MySQL treats as an escape char. */
  private static quoteLiteral(value: string): string {
    return `'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }

  /** A backtick identifier: a backtick inside one is written twice. */
  private static quoteIdentifier(value: string): string {
    return `\`${String(value ?? '').replace(/`/g, '``')}\``;
  }

  async queryRaw(sqlText: string, values: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    const [rows] = await this.pool.query(sqlText, values as any[]);
    return (Array.isArray(rows) ? rows : []) as Array<Record<string, unknown>>;
  }

  /**
   * Run a statement, translating the two portable idioms MySQL does not have.
   *
   * This is what a dialect is FOR. Every migration in the tree writes
   * `CREATE INDEX IF NOT EXISTS` and `DROP INDEX IF EXISTS`, which PostgreSQL and SQLite both accept
   * and MySQL rejects as a syntax error. There are 43 of the first across 16 migrations; branching
   * each one would put the same three lines in sixteen places and oblige every future migration to
   * remember MySQL exists.
   *
   * It is a translation, not an override: the statement means exactly what it said, and anything
   * this does not recognise is passed through untouched. `ER_DUP_KEYNAME` is the "already there"
   * answer being asked for, and `ER_CANT_DROP_FIELD_OR_KEY` is its counterpart on the way out — any
   * OTHER error still propagates, so a genuinely broken index statement fails as loudly as before.
   */
  async execute(query: any) {
    const statement = MysqlDatabaseManager.statementText(query);

    if (statement && /^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s/i.test(statement)) {
      return MysqlDatabaseManager.ignoring('ER_DUP_KEYNAME', async () =>
        MysqlDatabaseManager.rowsOf(await this.drizzle.execute(sql.raw(statement.replace(/\s+IF\s+NOT\s+EXISTS\s+/i, ' ')))));
    }

    // `ALTER TABLE t DROP COLUMN IF EXISTS c` — PostgreSQL has it, MySQL does not, and migrations
    // write it. ER_CANT_DROP_FIELD_OR_KEY is the "already gone" answer being asked for.
    if (statement && /^\s*ALTER\s+TABLE\s+.+\sDROP\s+COLUMN\s+IF\s+EXISTS\s/i.test(statement)) {
      return MysqlDatabaseManager.ignoring('ER_CANT_DROP_FIELD_OR_KEY', async () =>
        MysqlDatabaseManager.rowsOf(await this.drizzle.execute(
          sql.raw(statement.replace(/\sDROP\s+COLUMN\s+IF\s+EXISTS\s+/i, ' DROP COLUMN ')))));
    }

    if (statement && /^\s*DROP\s+INDEX\s+IF\s+EXISTS\s/i.test(statement)) {
      return MysqlDatabaseManager.ignoring('ER_CANT_DROP_FIELD_OR_KEY', async () =>
        MysqlDatabaseManager.rowsOf(await this.drizzle.execute(sql.raw(statement.replace(/\s+IF\s+EXISTS\s+/i, ' ')))));
    }

    return MysqlDatabaseManager.rowsOf(await this.drizzle.execute(query));
  }

  /**
   * The ROWS of a result, discarding mysql2's field metadata.
   *
   * `drizzle.execute()` on this driver resolves to `[rows, fields]`, which every caller in the tree
   * reads wrongly: the idiom migrations use is
   * `Array.isArray(result) ? result : result?.rows ?? []`, and against a two-element tuple that
   * answers "two rows" for ANY query. `tableExists` therefore said yes about tables that did not
   * exist, and a migration guarded by it silently skipped its own work.
   *
   * Returning the rows matches SQLite (a plain array) and is compatible with the PostgreSQL shape
   * that idiom already handles, so the same migration code is correct on all three.
   */
  private static rowsOf(result: any): any {
    if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0])) return result[0];
    return result;
  }

  /** The SQL a drizzle statement carries, when it is a plain one we can read. Otherwise empty. */
  private static statementText(query: any): string {
    const chunks = query?.queryChunks;
    if (!Array.isArray(chunks)) return '';
    // A statement built only from static text has no parameters to lose; one with bindings is left
    // alone, because rebuilding it from its text would drop them.
    if (chunks.some((chunk: any) => chunk?.value === undefined && chunk?.encoder)) return '';
    return chunks.map((chunk: any) => (Array.isArray(chunk?.value) ? chunk.value.join('') : '')).join('');
  }

  /** Run `fn`, treating one MySQL error code as success — the state the caller asked for. */
  private static async ignoring(code: string, fn: () => Promise<any>): Promise<any> {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.code === code || error?.cause?.code === code) return undefined;
      throw error;
    }
  }

  invalidateTableCache(tableName: string): void {
    this.normalizer.invalidateTableCache(tableName);
  }

  /**
   * A drizzle table built from column names the caller used.
   *
   * The KEY stays exactly as given so the caller's data object still matches, while the SQL NAME is
   * snake_cased — which is the convention every table in this schema is created with, and what
   * PostgreSQL's writer already does explicitly. Without it a write of `{ userId }` emitted
   * `` `userId` `` and MySQL answered "Unknown column", so every insert carrying a camelCase key
   * failed: creating the first administrator died on `_system_sessions`.
   */
  private getDynamicTable(tableName: string, columns: string[]) {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = text(NamingStrategy.toSnakeCase(col));
    }
    return mysqlTable(tableName, tableColumns);
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    return this.reader.find(tableOrName, options);
  }

  async findOne(tableName: string, where: any): Promise<any | null> {
    const results = await this.find(tableName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableName: string, data: any): Promise<any> {
    const normalizedData = await this.normalizer.normalizeDataForTable(tableName, data);
    const columns = Object.keys(normalizedData);
    const table = this.getDynamicTable(tableName, columns);
    const [result] = await this.drizzle.insert(table).values(normalizedData);

    // MySQL insert doesn't return the row with .returning() usually (depends on driver/version)
    // For now, return what we have or try to fetch it if needed.
    // In many cases, result.insertId is useful.
    return { ...normalizedData, id: result.insertId };
  }

  async update(tableName: string, where: any, data: any): Promise<any> {
    const normalizedData = await this.normalizer.normalizeDataForTable(tableName, data);
    const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, where);
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

  async delete(tableOrName: any, where: any): Promise<boolean> {
    if (typeof tableOrName === 'string') {
      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableOrName, where);
      const columns = Object.keys(normalizedWhere || {});
      const table = this.getDynamicTable(tableOrName, columns);

      const conditions = this.buildWhereConditions(normalizedWhere);
      const [result] = await this.drizzle.delete(table).where(and(...conditions));
      return result.affectedRows > 0;
    }

    const isPlainWhere = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    const conditions = this.buildWhereConditions(where, tableOrName);
    let query = this.drizzle.delete(tableOrName);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else if (where && (!isPlainWhere || Object.keys(where).length > 0)) {
      query = query.where(where);
    } else {
      throw new Error('Unsafe delete blocked: missing where clause');
    }
    const [result] = await query;
    return result.affectedRows > 0;
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    return this.reader.count(tableOrName, options);
  }

  /** COUNT(*) per group — SQL aggregation, so analytics never page rows into memory to count them. */
  async groupCount(
    tableName: string,
    options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number },
  ): Promise<Array<Record<string, unknown>>> {
    return this.reader.groupCount(tableName, options);
  }

  // Schema Management
  async getTables(): Promise<string[]> {
    const result: any = await this.execute(sql`SHOW TABLES`);
    return result.map((r: any) => Object.values(r)[0]);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    const result: any = await this.execute(query);
    return (result[0]?.total || 0) > 0;
  }

  /**
   * The column names of one table, lower-cased.
   *
   * Two things here are not cosmetic. `information_schema` returns `COLUMN_NAME` in upper case on
   * MySQL 8, so reading `r.column_name` got `undefined` from every row — which surfaced as
   * "Cannot read properties of undefined" rather than as anything about columns; the alias fixes the
   * shape whatever the server's case conventions are. And the query MUST be scoped to the current
   * schema: `information_schema` spans every database on the server, so without it a host running two
   * deployments answered with both of their columns merged, and a guard asking "does this table
   * already have this column" got yes from somebody else's table.
   */
  async getColumns(tableName: string): Promise<string[]> {
    const query = sql`
      SELECT column_name AS name FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ${tableName}`;
    const result: any = await this.execute(query);
    return (result ?? []).map((row: any) => String(row.name ?? row.COLUMN_NAME ?? '').toLowerCase()).filter(Boolean);
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
    await this.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of tables) {
      await this.execute(sql`DROP TABLE ${sql.identifier(table)}`);
    }
    await this.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  }
}
