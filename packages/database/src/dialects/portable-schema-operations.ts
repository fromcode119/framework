import { SortDirection } from '@database/enums/sort-direction.enum';
import type { IIndexColumn } from '@database/interfaces/index-column.interface';

/**
 * The schema statements a migration used to hand-write through `execute`, as validated operations.
 *
 * Plugin migrations run on the schema-owner connection, where raw SQL can do anything the owner can —
 * including switching row-level security off. These are the statements they legitimately need
 * (an index, dropping a table or a column, copying a value into a column that replaced it), written
 * here from identifiers that are checked, never interpolated as given. The SQL is portable across
 * the drivers: only reading a key out of a JSON column differs, and the driver supplies that.
 */
export class PortableSchemaOperations {
  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  constructor(
    private readonly run: (statement: string) => Promise<unknown>,
    private readonly jsonKeyExpression: (quotedColumn: string, key: string) => string =
      (quotedColumn, key) => `json_extract(${quotedColumn}, '$.${key}')`,
  ) {}

  async createIndexIfMissing(
    table: string,
    indexName: string,
    columns: Array<string | IIndexColumn>,
    options?: { unique?: boolean },
  ): Promise<void> {
    const list = columns.map((column) => {
      if (typeof column === 'string') return PortableSchemaOperations.quote(column, 'column');
      const quoted = PortableSchemaOperations.quote(column.name, 'column');
      return column.order === SortDirection.ASC || column.order === SortDirection.DESC ? `${quoted} ${column.order}` : quoted;
    });
    if (list.length === 0) throw new Error(`Refusing an index with no columns: ${indexName}`);
    const unique = options?.unique ? 'UNIQUE ' : '';
    await this.run(
      `CREATE ${unique}INDEX IF NOT EXISTS ${PortableSchemaOperations.quote(indexName, 'index')} `
      + `ON ${PortableSchemaOperations.quote(table, 'table')} (${list.join(', ')})`,
    );
  }

  async dropTableIfExists(table: string): Promise<void> {
    await this.run(`DROP TABLE IF EXISTS ${PortableSchemaOperations.quote(table, 'table')}`);
  }

  /** `DROP COLUMN IF EXISTS` where the engine has it; an older engine without it, or no such column, is a no-op. */
  async dropColumnIfExists(table: string, column: string): Promise<void> {
    const target = `ALTER TABLE ${PortableSchemaOperations.quote(table, 'table')} DROP COLUMN`;
    const quoted = PortableSchemaOperations.quote(column, 'column');
    try {
      await this.run(`${target} IF EXISTS ${quoted}`);
    } catch {
      try {
        await this.run(`${target} ${quoted}`);
      } catch {
        // The column is not there — nothing to drop.
      }
    }
  }

  /**
   * Fill `target` from `source` (or from `source`'s JSON key `jsonKey`) on every row where `target` is
   * still NULL — the data half of promoting a value into its own column. Never overwrites a value.
   */
  async copyColumnValues(table: string, target: string, source: string, jsonKey?: string): Promise<void> {
    const quotedTarget = PortableSchemaOperations.quote(target, 'column');
    const quotedSource = PortableSchemaOperations.quote(source, 'column');
    const value = jsonKey
      ? this.jsonKeyExpression(quotedSource, PortableSchemaOperations.check(jsonKey, 'JSON key'))
      : quotedSource;
    await this.run(
      `UPDATE ${PortableSchemaOperations.quote(table, 'table')} SET ${quotedTarget} = ${value} `
      + `WHERE ${quotedTarget} IS NULL AND ${value} IS NOT NULL`,
    );
  }

  private static quote(value: string, kind: string): string {
    return `"${PortableSchemaOperations.check(value, kind)}"`;
  }

  private static check(value: string, kind: string): string {
    if (!PortableSchemaOperations.IDENTIFIER.test(String(value ?? ''))) {
      throw new Error(`Refusing unsafe SQL identifier for ${kind}: ${String(value)}`);
    }
    return value;
  }
}
