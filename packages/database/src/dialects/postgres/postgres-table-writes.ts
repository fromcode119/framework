import { sql, is, SQL, Param, Column } from 'drizzle-orm';
import { PostgresTableStatements } from '@database/dialects/postgres/postgres-table-statements';

/**
 * INSERT, UPDATE, UPSERT and DELETE on a typed table, assembled here rather than by Drizzle's builders.
 *
 * Each statement is the one Drizzle's builder sends — the same columns in the same order, `default`
 * for an absent value, each value encoded by its own column — and `returning` rows are decoded the way
 * reads are (see `PostgresTableStatements`).
 *
 * `DB_WRITE_PATH`: `own` (default) uses this, `drizzle` the builders, `shadow` builds both statements,
 * logs any difference, and runs Drizzle's — never both, which would write twice.
 */
export class PostgresTableWrites {
  static mode(): string {
    const mode = String(process.env.DB_WRITE_PATH ?? '').trim().toLowerCase();
    return mode === 'drizzle' || mode === 'shadow' ? mode : 'own';
  }

  constructor(
    private readonly statements: PostgresTableStatements,
    private readonly dialect: { sqlToQuery(query: any): { sql: string; params: unknown[] } },
  ) {}

  insertStatement(table: object, data: Record<string, unknown>): { text: string; params: unknown[] } {
    const { names, values } = this.insertValues(table, data);
    return this.render(sql`insert into ${table} ${names} values ${values} returning ${sql.raw(this.statements.columnList(table))}`);
  }

  /** `target` is the conflict column (or columns) — the table's own column objects. */
  upsertStatement(table: object, data: Record<string, unknown>, target: any, set: Record<string, unknown>): { text: string; params: unknown[] } {
    const { names, values } = this.insertValues(table, data);
    const targets = (Array.isArray(target) ? target : [target]).map((column: any) => this.render(sql`${sql.identifier(String(column.name))}`).text).join(',');
    const assignments = this.assignments(table, set);
    return this.render(sql`insert into ${table} ${names} values ${values} on conflict (${sql.raw(targets)}) do update set ${assignments} returning ${sql.raw(this.statements.columnList(table))}`);
  }

  /** `where` is the filter fragment; a write with none is refused, as for every other table. */
  updateStatement(table: object, data: Record<string, unknown>, where: any): { text: string; params: unknown[] } {
    if (!where) throw new Error('Unsafe update blocked: missing where clause');
    return this.render(sql`update ${table} set ${this.assignments(table, data)} where ${where} returning ${sql.raw(this.statements.columnList(table))}`);
  }

  deleteStatement(table: object, where: any): { text: string; params: unknown[] } {
    if (!where) throw new Error('Unsafe delete blocked: missing where clause');
    return this.render(sql`delete from ${table} where ${where} returning ${sql.raw(this.statements.columnList(table))}`);
  }

  /**
   * Runs `statement` and answers its decoded `returning` rows. Under `shadow`, `builder` (the Drizzle
   * query for the same write) is compared with it and is the one that runs.
   */
  async run(
    executor: { query(config: any, values?: unknown[]): Promise<any> },
    table: object,
    label: string,
    statement: () => { text: string; params: unknown[] },
    builder: () => any,
  ): Promise<Array<Record<string, unknown>>> {
    const own = statement();
    if (PostgresTableWrites.mode() === 'shadow') {
      const query = builder();
      const built = query.toSQL();
      PostgresTableStatements.compare(`${label} (statement)`, own, { text: built.sql, params: built.params });
      return query;
    }
    const result = await executor.query({ text: own.text, rowMode: 'array', types: PostgresTableStatements.TYPES }, own.params);
    return this.statements.decode(table, result.rows);
  }

  /** Every insertable column, and its value: the caller's, else the column's default. */
  private insertValues(table: object, data: Record<string, unknown>): { names: any[]; values: any[] } {
    const columns = this.statements.fields(table).filter(([, column]) => !column.shouldDisableInsert());
    const values = columns.map(([key, column]) => {
      const value = data[key];
      if (value === undefined || (is(value, Param) && value.value === undefined)) {
        if (column.defaultFn !== undefined) return this.generated(column.defaultFn(), column);
        if (!column.default && column.onUpdateFn !== undefined) return this.generated(column.onUpdateFn(), column);
        return sql`default`;
      }
      return is(value, SQL) ? value : sql.param(value, column);
    });
    return { names: columns.map(([, column]) => sql.identifier(String(column.name))), values };
  }

  /** `column = value` for each defined value, in column order; columns with an update function always. */
  private assignments(table: object, data: Record<string, unknown>): SQL {
    const set = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    if (Object.keys(set).length === 0) throw new Error('No values to set');
    const assigned = this.statements.fields(table).filter(([key, column]) => set[key] !== undefined || column.onUpdateFn !== undefined);
    return sql.join(assigned.map(([key, column]) => {
      const value = set[key];
      const operand = value === undefined ? this.generated(column.onUpdateFn(), column) : (is(value, SQL) || is(value, Column) ? value : sql.param(value, column));
      return sql`${sql.identifier(String(column.name))} = ${operand}`;
    }), sql`, `);
  }

  private generated(value: unknown, column: any): unknown {
    return is(value, SQL) ? value : sql.param(value, column);
  }

  private render(query: SQL): { text: string; params: unknown[] } {
    const { sql: text, params } = this.dialect.sqlToQuery(query);
    return { text, params };
  }
}
