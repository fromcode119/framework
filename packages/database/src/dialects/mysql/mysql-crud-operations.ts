import { PortableSchemaOperations } from '@database/dialects/portable-schema-operations';
import type { IIndexColumn } from '@database/interfaces/index-column.interface';
import type { IAggregateOptions } from '@database/interfaces/aggregate-options.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import { BaseDialect } from '@database/dialects/base-dialect';
import { Sql } from '@database/sql/sql';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import type { MysqlTableStatements } from '@database/dialects/mysql/mysql-table-statements';

/**
 * Reading and writing rows, and the schema calls beside them — the MySQL half.
 *
 * A LINK in the chain rather than a collaborator, for the same reason as the Postgres one: this IS
 * the manager's published surface, and putting `find`/`insert`/`update` behind delegators would add a
 * hop to every database call to move a line count.
 */
export abstract class MysqlCrudOperations extends BaseDialect {
  protected declare reader: any;
  protected declare normalizer: any;
  protected declare schemaBuilder: any;
  protected declare statements: MysqlTableStatements;

  abstract execute(query: any): Promise<any>;
  protected abstract getDynamicTable(tableName: string, columns: string[]): any;

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
    const result = await this.statements.write(this.statements.writes.insertStatement(table, normalizedData));

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

    // With no filter this used to run with NO where — every row rewritten. Refused, as on every dialect.
    const filter = SqlTableReads.filter(this.buildWhereConditions(normalizedWhere), normalizedWhere);
    await this.statements.write(this.statements.writes.updateStatement(table, normalizedData, filter));

    return this.findOne(tableName, normalizedWhere);
  }

  async upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any> {
    // MySQL's form of an upsert: on a duplicate key, the row is updated with `set`.
    const result = await this.statements.write(this.statements.writes.upsertOnDuplicateStatement(tableOrName, data, options.set));
    return { ...data, id: result.insertId };
  }

  async delete(tableOrName: any, where: any): Promise<boolean> {
    if (typeof tableOrName === 'string') {
      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableOrName, where);
      const columns = Object.keys(normalizedWhere || {});
      const table = this.getDynamicTable(tableOrName, columns);

      // With no filter this used to delete EVERY row. Refused, as on every dialect.
      const filter = SqlTableReads.filter(this.buildWhereConditions(normalizedWhere), normalizedWhere);
      const result = await this.statements.write(this.statements.writes.deleteStatement(table, filter));
      return result.affectedRows > 0;
    }

    const filter = SqlTableReads.filter(this.buildWhereConditions(where, tableOrName), where);
    const result = await this.statements.write(this.statements.writes.deleteStatement(tableOrName, filter));
    return result.affectedRows > 0;
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
    const result: any = await this.execute(Sql.query`SHOW TABLES`);
    return result.map((r: any) => Object.values(r)[0]);
  }

  /**
   * Scoped to the current schema for the same reason as {@link getColumns}: `information_schema` spans
   * every database on the server, so unscoped this answered yes for a table that exists only in
   * ANOTHER installation on the same server — and a migration guarded by it then ran against a table
   * that was not there.
   */
  async tableExists(tableName: string): Promise<boolean> {
    const query = Sql.query`SELECT count(*) as total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ${tableName}`;
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
    const query = Sql.query`
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
    await this.execute(Sql.query`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of tables) {
      await this.execute(Sql.query`DROP TABLE ${Sql.identifier(table)}`);
    }
    await this.execute(Sql.query`SET FOREIGN_KEY_CHECKS = 1`);
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
