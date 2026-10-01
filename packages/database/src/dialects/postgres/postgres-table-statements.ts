import { types } from 'pg';
import type { ITableReadParts } from '@database/interfaces/table-read-parts.interface';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import { SqlTableWrites } from '@database/sql/sql-table-writes';

/**
 * Runs reads and writes on a declared table over a Postgres connection — the statements are
 * `SqlTableReads`/`SqlTableWrites`; this is how rows come back and are decoded.
 */
export class PostgresTableStatements {
  /** Timestamps, dates and intervals reach the column decoders as the text Postgres sent. */
  private static readonly RAW_TYPE_IDS = new Set<number>([
    types.builtins.TIMESTAMPTZ, types.builtins.TIMESTAMP, types.builtins.DATE, types.builtins.INTERVAL, 1231, 1115, 1185, 1187, 1182,
  ]);

  static readonly TYPES = {
    getTypeParser: (typeId: number, format?: any) =>
      PostgresTableStatements.RAW_TYPE_IDS.has(typeId) ? (value: unknown) => value : (types.getTypeParser as any)(typeId, format),
  };

  private readonly reads = SqlTableReads.POSTGRES;

  /** The filter a caller meant — see `SqlTableReads.filter`. */
  static filter(conditions: any[], where: any): any {
    return SqlTableReads.filter(conditions, where);
  }

  async find(executor: { query(config: any, values?: unknown[]): Promise<any> }, table: object, parts: ITableReadParts): Promise<Array<Record<string, unknown>>> {
    const { text, params } = this.reads.selectStatement(table, parts);
    const result = await executor.query({ text, rowMode: 'array', types: PostgresTableStatements.TYPES }, params);
    return this.reads.decodeRead(table, parts, result.rows);
  }

  async count(executor: { query(config: any, values?: unknown[]): Promise<any> }, table: object, parts: ITableReadParts): Promise<number> {
    const { text, params } = this.reads.countStatement(table, parts);
    const result = await executor.query({ text, rowMode: 'array' }, params);
    return Number(result.rows[0]?.[0] || 0);
  }

  /** Runs a write from `SqlTableWrites.POSTGRES` and answers its decoded `returning` rows. */
  async write(executor: { query(config: any, values?: unknown[]): Promise<any> }, table: object, statement: { text: string; params: unknown[] }): Promise<Array<Record<string, unknown>>> {
    const result = await executor.query({ text: statement.text, rowMode: 'array', types: PostgresTableStatements.TYPES }, statement.params);
    return this.reads.decode(table, result.rows);
  }

  get writes(): SqlTableWrites {
    return SqlTableWrites.POSTGRES;
  }
}
