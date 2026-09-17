import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import { BaseDialect } from '@database/dialects/base-dialect';
import { NamingStrategy } from '@database/naming-strategy';
import { PostgresTimestampPredicate } from '@database/dialects/postgres/timestamp-predicate';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, desc, asc, ilike } from 'drizzle-orm';

/**
 * Reading and writing rows, and the schema calls that sit beside them.
 *
 * A LINK in the chain rather than a collaborator, because this IS the manager's published surface —
 * `find`, `insert`, `update`, `delete`, `count` are what every caller in the platform uses, and
 * putting them behind delegators would add a hop to every database call in the codebase to move a
 * line count.
 *
 * The fields it needs are declared here as `declare` and assigned by the manager's constructor; the
 * dialect hooks come from `BaseDialect` underneath.
 */
export abstract class PostgresCrudOperations extends BaseDialect {
  protected declare pool: any;
  protected declare reader: any;
  protected abstract get executor(): { query: (text: any, values?: any[]) => Promise<any> };
  protected declare normalizer: any;
  protected declare schemaBuilder: any;
  public declare readonly drizzle: any;

  /**
   * The connection a statement must use: the request's held client inside a tenant scope, the pool
   * otherwise. Declared abstract because the manager owns the pool and therefore the choice — this
   * half must never pick a connection for itself.
   */
  protected abstract get orm(): any;

  /** Runs one statement on whichever connection the manager decides. Implemented by the manager. */
  abstract execute(query: any): Promise<any>;

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    return this.reader.find(tableOrName, options);
  }

  async findOne(tableOrName: any, where: any): Promise<any | null> {
    const results = await this.find(tableOrName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableOrName: any, data: any): Promise<any> {
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const columns = Object.keys(data || {});
      if (!columns.length) {
        const result = await this.executor.query(`INSERT INTO "${tableName}" DEFAULT VALUES RETURNING *`);
        return result.rows[0] || null;
      }
      const identifiers = columns.map((column) => `"${NamingStrategy.toSnakeCase(column)}"`).join(', ');
      const placeholders = columns.map((_, index) => this.getParamPlaceholder(index + 1)).join(', ');
      const values = await Promise.all(
        columns.map((column) => this.normalizer.normalizeColumnValueForWrite(tableName, column, data[column]))
      );
      const result = await this.executor.query(
        `INSERT INTO "${tableName}" (${identifiers}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0] || null;
    }
    const [result] = await this.orm.insert(tableOrName).values(data).returning();
    return result;
  }

  async update(tableOrName: any, where: any, data: any): Promise<any> {
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const setColumns = Object.keys(data || {});
      const whereColumns = Object.keys(where || {});
      if (!setColumns.length) throw new Error(`No update fields provided for table "${tableName}"`);
      if (!whereColumns.length) throw new Error(`Unsafe update blocked: missing where clause for table "${tableName}"`);

      const setClause = setColumns.map((column, index) => `"${NamingStrategy.toSnakeCase(column)}" = ${this.getParamPlaceholder(index + 1)}`).join(', ');
      // Equality on a Date operand compares at the driver's read-back precision — see
      // PostgresTimestampPredicate; this is what keeps `update(table, { id, updatedAt }, …)`
      // optimistic locks matching the row they just read.
      const whereClause = whereColumns.map((column, index) => `${this.equalityColumnExpression(`"${NamingStrategy.toSnakeCase(column)}"`, where[column])} = ${this.getParamPlaceholder(setColumns.length + index + 1)}`).join(' AND ');

      const setValues = await Promise.all(
        setColumns.map((column) => this.normalizer.normalizeColumnValueForWrite(tableName, column, data[column]))
      );
      const whereValues = await Promise.all(
        whereColumns.map((column) => this.normalizer.normalizeColumnValueForWrite(tableName, column, where[column]))
      );
      const values = [...setValues, ...whereValues];

      const result = await this.executor.query(`UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause} RETURNING *`, values);
      return result.rows[0] || null;
    }

    const conditions = this.buildWhereConditions(where, tableOrName);
    const [result] = await this.orm
      .update(tableOrName)
      .set(data)
      .where(and(...conditions))
      .returning();
    return result;
  }

  async upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any> {
    const { target, set } = options;
    const query = this.orm.insert(tableOrName).values(data).onConflictDoUpdate({
      target: typeof target === 'string' ? (tableOrName as any)[target] : target,
      set
    }).returning();
    const [result] = await query;
    return result;
  }

  async delete(tableOrName: any, where: any): Promise<boolean> {
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, where);
      const { sql: whereClause, values } = this.buildRawWhereClause(normalizedWhere);
      if (!whereClause) throw new Error(`Unsafe delete blocked: missing where clause for table "${tableName}"`);

      const result = await this.executor.query(`DELETE FROM "${tableName}"${whereClause} RETURNING *`, values);
      return (result.rowCount || 0) > 0;
    }

    const isPlainWhere = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    const conditions = this.buildWhereConditions(where, tableOrName);
    let query = this.orm.delete(tableOrName);
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

  protected getParamPlaceholder(index: number): string {
    return `$${index}`;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const result = await this.executor.query(sqlStr, values);
    return result.rows;
  }

  async queryRaw(sqlText: string, values: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    const result = await this.executor.query(sqlText, values);
    return (result?.rows ?? []) as Array<Record<string, unknown>>;
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
    const query = sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const result: any = await this.execute(query);
    return result.rows.map((r: any) => r.table_name);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    const result: any = await this.execute(query);
    return (result.rows[0]?.total || 0) > 0;
  }

  async getColumns(tableName: string): Promise<string[]> {
    const result: any = await this.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName}`);
    return result.rows.map((r: any) => r.column_name.toLowerCase());
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
    await this.execute(sql`DROP SCHEMA public CASCADE`);
    await this.execute(sql`CREATE SCHEMA public`);
  }
}
