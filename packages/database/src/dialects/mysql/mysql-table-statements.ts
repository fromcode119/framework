import type mysql from 'mysql2/promise';
import type { ITableReadParts } from '@database/interfaces/table-read-parts.interface';
import { SqlRenderer } from '@database/sql/sql-renderer';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import { SqlTableWrites } from '@database/sql/sql-table-writes';

/**
 * Runs statements on MySQL. Dates, datetimes and timestamps come back as the text MySQL sent — the
 * column decoders, and every caller of `execute`, read them that way.
 */
export class MysqlTableStatements {
  private static readonly TYPE_CAST = (field: any, next: () => unknown) =>
    field.type === 'TIMESTAMP' || field.type === 'DATETIME' || field.type === 'DATE' ? field.string() : next();

  private readonly reads = SqlTableReads.MYSQL;

  constructor(private readonly pool: mysql.Pool) {}

  get writes(): SqlTableWrites {
    return SqlTableWrites.MYSQL;
  }

  /** `[result, fields]`, as mysql2 answers a query: rows for a read, a header for a write. */
  query(text: string, params: unknown[]): Promise<any> {
    return this.pool.query({ sql: text, typeCast: MysqlTableStatements.TYPE_CAST } as any, params as any[]);
  }

  /** Rows as arrays, in selected-column order. */
  async arrays(text: string, params: unknown[]): Promise<unknown[][]> {
    const [rows] = await this.pool.query({ sql: text, rowsAsArray: true, typeCast: MysqlTableStatements.TYPE_CAST } as any, params as any[]);
    return rows as unknown[][];
  }

  /** Renders a built statement and runs it. */
  run(query: unknown): Promise<any> {
    const { text, params } = SqlRenderer.MYSQL.render(query);
    return this.query(text, params);
  }

  async find(table: object, parts: ITableReadParts): Promise<Array<Record<string, unknown>>> {
    const { text, params } = this.reads.selectStatement(table, parts);
    return this.reads.decodeRead(table, parts, await this.arrays(text, params));
  }

  async count(table: object, parts: ITableReadParts): Promise<number> {
    const { text, params } = this.reads.countStatement(table, parts);
    const [row] = await this.arrays(text, params);
    return Number(row?.[0] || 0);
  }

  /** A write from `writes`; MySQL has no RETURNING, so the answer is mysql2's header. */
  async write(statement: { text: string; params: unknown[] }): Promise<{ insertId: number; affectedRows: number }> {
    const [header] = await this.query(statement.text, statement.params);
    return header;
  }
}
