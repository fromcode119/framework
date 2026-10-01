import { Sql } from '@database/sql/sql';
import { SqlColumn } from '@database/sql/sql-column';
import { SqlFragment } from '@database/sql/sql-fragment';
import { SqlParam } from '@database/sql/sql-param';
import { SqlTableReads } from '@database/sql/sql-table-reads';

/**
 * INSERT, UPDATE, UPSERT and DELETE on a declared table, for any dialect.
 *
 * An insert names every column, in declaration order, and writes `default` for any value not given;
 * each value is encoded by its own column. `returning` (Postgres, SQLite) answers the written rows in
 * the table's column order, for `SqlTableReads.decode`; MySQL has no RETURNING and is asked for none.
 * SQLite has no `default` keyword in VALUES, so there an absent value is the column's declared default
 * written out, else `null`.
 */
export class SqlTableWrites {
  static readonly POSTGRES = new SqlTableWrites(SqlTableReads.POSTGRES, true, false);
  static readonly SQLITE = new SqlTableWrites(SqlTableReads.SQLITE, true, true);
  static readonly MYSQL = new SqlTableWrites(SqlTableReads.MYSQL, false, false);

  private constructor(readonly reads: SqlTableReads, private readonly returning: boolean, private readonly writesDefaults: boolean) {}

  /** One row, or several in one statement. */
  insertStatement(table: object, data: Record<string, unknown> | Array<Record<string, unknown>>): { text: string; params: unknown[] } {
    return this.reads.renderer.render(Sql.join([this.insertInto(table, data), this.returningClause(table)]));
  }

  /** On a conflict over `target` — the table's own column objects — the row is updated with `set`. */
  upsertStatement(table: object, data: Record<string, unknown> | Array<Record<string, unknown>>, target: unknown, set: Record<string, unknown>): { text: string; params: unknown[] } {
    const targets = (Array.isArray(target) ? target : [target]).map((column: SqlColumn) => this.reads.renderer.escapeName(column.name)).join(',');
    return this.reads.renderer.render(Sql.join([this.insertInto(table, data), Sql.query` on conflict (${Sql.raw(targets)}) do update set ${this.assignments(table, set)}`, this.returningClause(table)]));
  }

  /** MySQL's form: on a duplicate key, the row is updated with `set`. */
  upsertOnDuplicateStatement(table: object, data: Record<string, unknown> | Array<Record<string, unknown>>, set: Record<string, unknown>): { text: string; params: unknown[] } {
    return this.reads.renderer.render(Sql.join([this.insertInto(table, data), Sql.query` on duplicate key update ${this.assignments(table, set)}`]));
  }

  /** `where` is the filter fragment; a write with none is refused, as for every other table. */
  updateStatement(table: object, data: Record<string, unknown>, where: unknown): { text: string; params: unknown[] } {
    if (!where) throw new Error('Unsafe update blocked: missing where clause');
    return this.reads.renderer.render(Sql.join([Sql.query`update ${table} set ${this.assignments(table, data)} where ${where}`, this.returningClause(table)]));
  }

  deleteStatement(table: object, where: unknown): { text: string; params: unknown[] } {
    if (!where) throw new Error('Unsafe delete blocked: missing where clause');
    return this.reads.renderer.render(Sql.join([Sql.query`delete from ${table} where ${where}`, this.returningClause(table)]));
  }

  private insertInto(table: object, data: Record<string, unknown> | Array<Record<string, unknown>>): SqlFragment {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) throw new Error('values() must be called with at least one value');
    const columns = this.reads.fields(table).filter(([, column]) => !column.shouldDisableInsert());
    const names = columns.map(([, column]) => Sql.identifier(column.name));
    const values = Sql.join(rows.map((row) => columns.map(([key, column]) => this.insertValue(row[key], column))), Sql.raw(', '));
    return Sql.query`insert into ${table} ${names} values ${values}`;
  }

  private returningClause(table: object): SqlFragment {
    return this.returning ? Sql.query` returning ${Sql.raw(this.reads.columnList(table))}` : Sql.empty();
  }

  /** The caller's value, else the column's own default. */
  private insertValue(value: unknown, column: SqlColumn): unknown {
    if (value === undefined || (value instanceof SqlParam && value.value === undefined)) {
      if (this.writesDefaults && column.default !== null && column.default !== undefined) return this.bound(column.default, column);
      if (column.defaultFn !== undefined) return this.bound(column.defaultFn(), column);
      if (!column.default && column.onUpdateFn !== undefined) return this.bound(column.onUpdateFn(), column);
      return this.writesDefaults ? Sql.query`null` : Sql.query`default`;
    }
    return this.bound(value, column);
  }

  /** `column = value` for each defined value, in column order; a column with an update function always. */
  private assignments(table: object, data: Record<string, unknown>): SqlFragment {
    const set = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    if (Object.keys(set).length === 0) throw new Error('No values to set');
    const assigned = this.reads.fields(table).filter(([key, column]) => set[key] !== undefined || column.onUpdateFn !== undefined);
    return Sql.join(assigned.map(([key, column]) => {
      const value = set[key];
      const operand = value === undefined ? this.bound(column.onUpdateFn!(), column) : (value instanceof SqlColumn ? value : this.bound(value, column));
      return Sql.query`${Sql.identifier(column.name)} = ${operand}`;
    }), Sql.raw(', '));
  }

  /** SQL stays SQL; a value is bound through its column's encoder. */
  private bound(value: unknown, column: SqlColumn): unknown {
    return value instanceof SqlFragment ? value : Sql.param(value, column);
  }
}
