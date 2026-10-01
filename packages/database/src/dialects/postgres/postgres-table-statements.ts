import { isDeepStrictEqual } from 'util';
import { types } from 'pg';
import { sql, and, getTableColumns } from 'drizzle-orm';
import type { ITableReadParts } from '@database/interfaces/table-read-parts.interface';

/**
 * Whole-table SELECT and COUNT for a typed table, assembled here rather than by Drizzle's query builder.
 *
 * Drizzle rebuilt a table's full column list on every query — for a 46-column collection, ~350 µs of a
 * list request — and the read path made a new Drizzle instance per query on a site-bound connection.
 * The column list is built once per table here. Everything a result depends on stays exactly Drizzle's:
 * its dialect renders the statement (quoting, parameter numbering), it runs with the type parsers
 * Drizzle's driver uses (timestamps, dates and intervals as raw strings), and each value is decoded by
 * its own column's `mapFromDriverValue`, in the column order Drizzle selects.
 *
 * `DB_READ_PATH`: `own` (default) uses this, `drizzle` the builder, `shadow` runs both and logs any
 * difference — returning Drizzle's answer — which is how the two were proven equal.
 */
export class PostgresTableStatements {
  private static readonly shapes = new WeakMap<object, { list: string; from: string; fields: Array<[string, any]> }>();

  /** Drizzle's driver parsers: these types reach `mapFromDriverValue` as the strings Postgres sent. */
  private static readonly RAW_TYPE_IDS = new Set<number>([
    types.builtins.TIMESTAMPTZ, types.builtins.TIMESTAMP, types.builtins.DATE, types.builtins.INTERVAL, 1231, 1115, 1185, 1187, 1182,
  ]);

  static readonly TYPES = {
    getTypeParser: (typeId: number, format?: any) =>
      PostgresTableStatements.RAW_TYPE_IDS.has(typeId) ? (value: unknown) => value : (types.getTypeParser as any)(typeId, format),
  };

  /** The filter exactly as the builder applies it: the parsed `conditions`, else a caller's own SQL fragment. */
  static filter(conditions: any[], where: any): any {
    if (conditions.length > 0) return and(...conditions);
    const isPlain = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    return where && (!isPlain || Object.keys(where).length > 0) ? where : undefined;
  }

  static mode(): string {
    const mode = String(process.env.DB_READ_PATH ?? '').trim().toLowerCase();
    return mode === 'drizzle' || mode === 'shadow' ? mode : 'own';
  }

  constructor(private readonly dialect: { sqlToQuery(query: any): { sql: string; params: unknown[] } }) {}

  /** The statement Drizzle's `select().from(table)…` would send, with the column list built once per table. */
  selectStatement(table: object, parts: ITableReadParts): { text: string; params: unknown[] } {
    const chunks: any[] = [sql.raw(this.shapeOf(table).from)];
    if (parts.where) chunks.push(sql` where ${parts.where}`);
    if (parts.orderBy?.length) chunks.push(sql` order by ${sql.join(parts.orderBy, sql`, `)}`);
    if (parts.limit) chunks.push(sql` limit ${parts.limit}`);
    if (parts.offset) chunks.push(sql` offset ${parts.offset}`);
    const { sql: text, params } = this.dialect.sqlToQuery(sql.join(chunks));
    return { text, params };
  }

  /**
   * Rows of `table`, as Drizzle's `select().from(table)…` returns them. Under `shadow`, `builder` (that
   * Drizzle query) also runs: its statement and its rows are compared with ours, and its rows answer.
   */
  async find(executor: { query(config: any, values?: unknown[]): Promise<any> }, table: object, parts: ITableReadParts, builder: () => any): Promise<Array<Record<string, unknown>>> {
    const own = await this.select(executor, table, parts);
    if (PostgresTableStatements.mode() !== 'shadow') return own;
    const query = builder();
    const statement = this.selectStatement(table, parts);
    const label = `find ${statement.text.slice(0, 80)}`;
    const built = query.toSQL();
    PostgresTableStatements.compare(`${label} (statement)`, statement, { text: built.sql, params: built.params });
    const drizzleRows = await query;
    PostgresTableStatements.compare(label, own, drizzleRows);
    return drizzleRows;
  }

  private async select(
    executor: { query(config: any, values?: unknown[]): Promise<any> },
    table: object,
    parts: ITableReadParts,
  ): Promise<Array<Record<string, unknown>>> {
    const { text, params } = this.selectStatement(table, parts);
    const result = await executor.query({ text, rowMode: 'array', types: PostgresTableStatements.TYPES }, params);
    return this.decode(table, result.rows);
  }

  /** Rows read in `columnList` order, decoded to the table's field names by each column's own decoder. */
  decode(table: object, rows: unknown[][]): Array<Record<string, unknown>> {
    const { fields } = this.shapeOf(table);
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

  /** Every column of `table`, quoted, in the order Drizzle selects and returns them. */
  columnList(table: object): string {
    return this.shapeOf(table).list;
  }

  /** The table's fields — `[fieldName, column]` — in column order. */
  fields(table: object): Array<[string, any]> {
    return this.shapeOf(table).fields;
  }

  /** `count(*)` of `table` under `where`, as a number. Under `shadow`, compared with `builder`'s total, which answers. */
  async count(executor: { query(config: any, values?: unknown[]): Promise<any> }, table: object, where: any, builder: () => Promise<number>): Promise<number> {
    const query = where ? sql`select count(*) from ${table} where ${where}` : sql`select count(*) from ${table}`;
    const { sql: text, params } = this.dialect.sqlToQuery(query);
    const result = await executor.query({ text, rowMode: 'array' }, params);
    const own = Number(result.rows[0]?.[0] || 0);
    if (PostgresTableStatements.mode() !== 'shadow') return own;
    const drizzleTotal = await builder();
    PostgresTableStatements.compare('count', own, drizzleTotal);
    return drizzleTotal;
  }

  /** Under `shadow`, both answers are compared; a difference is logged, and Drizzle's answer is used. */
  static compare(label: string, own: unknown, drizzle: unknown, log: (line: string) => void = (line) => console.warn(line)): void {
    if (isDeepStrictEqual(own, drizzle)) return;
    log(`[db-read-shadow] ${label}: own query layer and Drizzle differ — ${PostgresTableStatements.firstDifference(own, drizzle)}`);
  }

  private static firstDifference(own: unknown, drizzle: unknown): string {
    if (!Array.isArray(own) || !Array.isArray(drizzle)) return `own=${JSON.stringify(own)} drizzle=${JSON.stringify(drizzle)}`;
    if (own.length !== drizzle.length) return `${own.length} rows vs ${drizzle.length}`;
    for (let index = 0; index < own.length; index += 1) {
      const keys = new Set([...Object.keys(own[index] ?? {}), ...Object.keys(drizzle[index] ?? {})]);
      for (const key of keys) {
        if (!isDeepStrictEqual(own[index]?.[key], drizzle[index]?.[key])) {
          return `row ${index} "${key}": own=${PostgresTableStatements.describe(own[index]?.[key])} drizzle=${PostgresTableStatements.describe(drizzle[index]?.[key])}`;
        }
      }
    }
    return 'equal fields, different structure';
  }

  private static describe(value: unknown): string {
    const kind = value === null ? 'null' : value instanceof Date ? 'Date' : typeof value;
    return `${kind} ${JSON.stringify(value)?.slice(0, 80)}`;
  }

  private shapeOf(table: object): { list: string; from: string; fields: Array<[string, any]> } {
    let shape = PostgresTableStatements.shapes.get(table);
    if (!shape) {
      const fields = Object.entries(getTableColumns(table as any)) as Array<[string, any]>;
      const list = fields.map(([, column]) => this.dialect.sqlToQuery(sql`${sql.identifier(String(column.name))}`).sql).join(', ');
      // The table as Drizzle's dialect names it (quoting, any schema), not as assembled here.
      shape = { list, from: `select ${list} from ${this.dialect.sqlToQuery(sql`${table}`).sql}`, fields };
      PostgresTableStatements.shapes.set(table, shape);
    }
    return shape;
  }
}
