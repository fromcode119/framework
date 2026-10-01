import { SqlFragment } from '@database/sql/sql-fragment';
import { SqlName } from '@database/sql/sql-name';
import { SqlParam } from '@database/sql/sql-param';
import { SqlText } from '@database/sql/sql-text';
import { SqlColumn } from '@database/sql/sql-column';
import { SqlTable } from '@database/sql/sql-table';

/**
 * Turns a fragment into one dialect's statement text and its bound values.
 *
 * Text is written as-is, identifiers quoted, a table by its (schema-qualified) name, a column as
 * `"table"."column"`, a list as `(a, b)`, and every other value bound — through its column's encoder
 * when it has one. Nothing a caller passes as a value ever becomes SQL text.
 */
export class SqlRenderer {
  static readonly POSTGRES = new SqlRenderer((name) => `"${name.replace(/"/g, '""')}"`, (index) => `$${index + 1}`);
  static readonly SQLITE = new SqlRenderer((name) => `"${name.replace(/"/g, '""')}"`, () => '?');
  static readonly MYSQL = new SqlRenderer((name) => `\`${name.replace(/`/g, '``')}\``, () => '?');

  private constructor(
    readonly escapeName: (name: string) => string,
    private readonly placeholder: (index: number) => string,
  ) {}

  render(query: unknown): { text: string; params: unknown[] } {
    const params: unknown[] = [];
    const text = this.chunk(query, params);
    return { text, params };
  }

  private chunk(chunk: unknown, params: unknown[]): string {
    if (chunk instanceof SqlText) return chunk.value;
    if (chunk instanceof SqlName) return this.escapeName(chunk.value);
    if (chunk === undefined) return '';
    if (Array.isArray(chunk)) return `(${chunk.map((item) => this.chunk(item, params)).join(', ')})`;
    if (chunk instanceof SqlFragment) return chunk.chunks.map((item) => this.chunk(item, params)).join('');
    if (chunk instanceof SqlTable) return this.table(chunk);
    if (chunk instanceof SqlColumn) return `${this.table(chunk.table)}.${this.escapeName(chunk.name)}`;
    if (chunk instanceof SqlParam) {
      const value = chunk.value === null || !chunk.encoder ? chunk.value : chunk.encoder.mapToDriverValue(chunk.value);
      if (value instanceof SqlFragment) return this.chunk(value, params);
      return this.bind(value, params);
    }
    return this.bind(chunk, params);
  }

  private table(table: object): string {
    const schema = SqlTable.schemaOf(table);
    const name = this.escapeName(SqlTable.nameOf(table));
    return schema === undefined ? name : `${this.escapeName(schema)}.${name}`;
  }

  private bind(value: unknown, params: unknown[]): string {
    params.push(value);
    return this.placeholder(params.length - 1);
  }
}
