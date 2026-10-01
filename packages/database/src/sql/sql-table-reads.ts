import type { ITableReadParts } from '@database/interfaces/table-read-parts.interface';
import { Sql } from '@database/sql/sql';
import { SqlColumn } from '@database/sql/sql-column';
import { SqlRenderer } from '@database/sql/sql-renderer';
import { SqlTable } from '@database/sql/sql-table';

/**
 * SELECT and COUNT on a declared table, for any dialect — the dialect's renderer quotes and binds.
 *
 * A whole-table read's column list is built once per table and kept. Rows are read as arrays, in the
 * selected column order, and each value is decoded by its own column — so a `jsonb` column is an
 * object, a timestamp a `Date`, a numeric the exact decimal text.
 */
export class SqlTableReads {
  static readonly POSTGRES = new SqlTableReads(SqlRenderer.POSTGRES);
  static readonly SQLITE = new SqlTableReads(SqlRenderer.SQLITE);
  static readonly MYSQL = new SqlTableReads(SqlRenderer.MYSQL);

  private readonly shapes = new WeakMap<object, { list: string; from: string; fields: Array<[string, SqlColumn]> }>();

  private constructor(readonly renderer: SqlRenderer) {}

  /** The filter a caller meant: the parsed `conditions`, else a caller's own SQL fragment. */
  static filter(conditions: any[], where: any): any {
    return Sql.and(...SqlTableReads.terms(conditions, where));
  }

  /** The filter ANDed with a search over named columns — one flat `and`, as one condition list. */
  static filterWithSearch(conditions: any[], where: any, search: unknown): any {
    return Sql.and(...SqlTableReads.terms(conditions, where), ...(search ? [search] : []));
  }

  private static terms(conditions: any[], where: any): any[] {
    if (conditions.length > 0) return conditions;
    const isPlain = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    return where && (!isPlain || Object.keys(where).length > 0) ? [where] : [];
  }

  /**
   * The statement for a read. With `columns`, only those fields, flat; with `joins` and no columns, a
   * row per table (`{ users: {...}, _system_users_roles: {...} | null }`); otherwise the whole table.
   */
  selectStatement(table: object, parts: ITableReadParts): { text: string; params: unknown[] } {
    const { from } = this.selection(table, parts);
    return this.renderer.render(Sql.join([Sql.raw(from), ...this.tail(parts)]));
  }

  /** The statement for `count(*)` of the rows a read with the same filter and joins would answer. */
  countStatement(table: object, parts: ITableReadParts): { text: string; params: unknown[] } {
    return this.renderer.render(Sql.join([Sql.query`select count(*) from ${table}`, ...this.joins(parts.joins), ...(parts.where ? [Sql.query` where ${parts.where}`] : [])]));
  }

  /** Array rows of a read, decoded: flat by field, or — joined with no columns picked — one object per table. */
  decodeRead(table: object, parts: ITableReadParts, rows: unknown[][]): Array<Record<string, unknown>> {
    const { fields, nested } = this.selection(table, parts);
    return nested ? this.decodeNested(nested, rows) : this.decodeFields(fields, rows);
  }

  /** Rows read in `columnList` order, decoded to the table's field names by each column's own decoder. */
  decode(table: object, rows: unknown[][]): Array<Record<string, unknown>> {
    return this.decodeFields(this.shapeOf(table).fields, rows);
  }

  /** Every column of `table`, quoted, in declaration order. */
  columnList(table: object): string {
    return this.shapeOf(table).list;
  }

  /** The table's fields — `[fieldName, column]` — in declaration order. */
  fields(table: object): Array<[string, SqlColumn]> {
    return this.shapeOf(table).fields;
  }

  private selection(table: object, parts: ITableReadParts): { from: string; fields: Array<[string, SqlColumn]>; nested?: Array<[string, Array<[string, SqlColumn]>]> } {
    const joined = !!parts.joins && parts.joins.length > 0;
    const picked = parts.columns ? Object.entries(parts.columns).filter(([, wanted]) => wanted) : [];
    if (picked.length === 0 && !joined) return this.shapeOf(table);
    const source = this.renderer.render(Sql.query`${table}`).text;
    if (picked.length > 0) {
      const fields = picked.map(([key]): [string, SqlColumn] => {
        const column = (table as any)[key];
        if (!(column instanceof SqlColumn)) throw new Error(`Unknown column "${key}" on table "${SqlTable.nameOf(table)}"`);
        return [key, column];
      });
      return { from: `select ${this.list(fields, joined)} from ${source}`, fields };
    }
    const nested = [table, ...parts.joins!.map((join) => join.table)].map((each): [string, Array<[string, SqlColumn]>] => [SqlTable.nameOf(each), this.shapeOf(each).fields]);
    const fields = nested.flatMap(([, each]) => each);
    return { from: `select ${this.list(fields, true)} from ${source}`, fields, nested };
  }

  /** Columns qualified by their table once another table is joined, as a lone table needs no qualifier. */
  private list(fields: Array<[string, SqlColumn]>, qualified: boolean): string {
    return fields.map(([, column]) => (qualified ? this.renderer.render(Sql.query`${column}`).text : this.renderer.escapeName(column.name))).join(', ');
  }

  private tail(parts: ITableReadParts): unknown[] {
    const chunks: unknown[] = [...this.joins(parts.joins)];
    if (parts.where) chunks.push(Sql.query` where ${parts.where}`);
    if (parts.orderBy?.length) chunks.push(Sql.query` order by ${Sql.join(parts.orderBy, Sql.raw(', '))}`);
    if (parts.limit) chunks.push(Sql.query` limit ${parts.limit}`);
    if (parts.offset) chunks.push(Sql.query` offset ${parts.offset}`);
    return chunks;
  }

  private joins(joins: ITableReadParts['joins']): unknown[] {
    if (!joins || joins.length === 0) return [];
    return [Sql.raw(' '), Sql.join(joins.map((join) => Sql.query`${Sql.raw(join.type === 'left' ? 'left' : 'inner')} join ${join.table}${join.on ? Sql.query` on ${join.on}` : undefined}`), Sql.raw(' '))];
  }

  private decodeFields(fields: Array<[string, SqlColumn]>, rows: unknown[][]): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const record: Record<string, unknown> = {};
      for (let index = 0; index < fields.length; index += 1) {
        const [key, column] = fields[index];
        const raw = row[index];
        record[key] = raw === null ? null : column.mapFromDriverValue(raw);
      }
      return record;
    });
  }

  /** One object per table; a joined table with no matching row — every value null — is null. */
  private decodeNested(tables: Array<[string, Array<[string, SqlColumn]>]>, rows: unknown[][]): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const record: Record<string, unknown> = {};
      let offset = 0;
      tables.forEach(([name, fields], position) => {
        const [values] = this.decodeFields(fields, [row.slice(offset, offset + fields.length)]);
        offset += fields.length;
        record[name] = position > 0 && Object.values(values).every((value) => value === null) ? null : values;
      });
      return record;
    });
  }

  private shapeOf(table: object): { list: string; from: string; fields: Array<[string, SqlColumn]> } {
    let shape = this.shapes.get(table);
    if (!shape) {
      const fields = Object.entries(SqlTable.columnsOf(table));
      const list = this.list(fields, false);
      shape = { list, from: `select ${list} from ${this.renderer.render(Sql.query`${table}`).text}`, fields };
      this.shapes.set(table, shape);
    }
    return shape;
  }
}
