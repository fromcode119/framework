import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, like, desc, asc } from 'drizzle-orm';
import { mysqlTable, text } from 'drizzle-orm/mysql-core';
import { IDatabaseManager, ISchemaCollection, ISchemaField } from '../../types';
import { BaseDialect } from '../base-dialect';
import { MysqlColumnNormalizer } from './column-normalizer';
import { MysqlSchemaBuilder } from './schema-builder';
import { MysqlReadOperations } from './read-operations';

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
    this.pool = mysql.createPool(connection);
    this.drizzle = drizzle(this.pool);
    this.normalizer = new MysqlColumnNormalizer(this.pool);
    this.schemaBuilder = new MysqlSchemaBuilder(this);
    this.reader = new MysqlReadOperations(this.pool, this.drizzle, this.normalizer, this.like);
  }

  async connect() {
    await this.pool.getConnection();
  }

  async execute(query: any) {
    return this.drizzle.execute(query);
  }

  invalidateTableCache(tableName: string): void {
    this.normalizer.invalidateTableCache(tableName);
  }

  private getDynamicTable(tableName: string, columns: string[]) {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = text(col);
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
    const conditions = this.buildWhereConditions(where);
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
