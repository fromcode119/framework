import type Database from 'better-sqlite3';
import type { ITableReadParts } from '@database/interfaces/table-read-parts.interface';
import { SqlRenderer } from '@database/sql/sql-renderer';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import { SqlTableWrites } from '@database/sql/sql-table-writes';

/**
 * Runs statements on SQLite: reads and writes on a declared table — `SqlTableReads`/`SqlTableWrites`,
 * rows read as arrays and decoded by each column — and any other built statement.
 */
export class SqliteTableStatements {
  private readonly reads = SqlTableReads.SQLITE;

  constructor(private readonly sqlite: Database.Database) {}

  get writes(): SqlTableWrites {
    return SqlTableWrites.SQLITE;
  }

  find(table: object, parts: ITableReadParts): Array<Record<string, unknown>> {
    const { text, params } = this.reads.selectStatement(table, parts);
    return this.reads.decodeRead(table, parts, this.sqlite.prepare(text).raw(true).all(...(params as any[])) as unknown[][]);
  }

  count(table: object, parts: ITableReadParts): number {
    const { text, params } = this.reads.countStatement(table, parts);
    const row = this.sqlite.prepare(text).raw(true).get(...(params as any[])) as unknown[] | undefined;
    return Number(row?.[0] || 0);
  }

  /** A write from `writes`, answering its decoded `returning` rows. */
  write(table: object, statement: { text: string; params: unknown[] }): Array<Record<string, unknown>> {
    return this.reads.decode(table, this.sqlite.prepare(statement.text).raw(true).all(...(statement.params as any[])) as unknown[][]);
  }

  /** Runs a built statement; answers what better-sqlite3 reports (changes, last row id). */
  run(query: unknown): Database.RunResult {
    const { text, params } = SqlRenderer.SQLITE.render(query);
    return this.sqlite.prepare(text).run(...(params as any[]));
  }

  /** Every row a built statement answers, as objects. */
  all(query: unknown): unknown[] {
    const { text, params } = SqlRenderer.SQLITE.render(query);
    return this.sqlite.prepare(text).all(...(params as any[]));
  }
}
