import { NamingStrategy } from '@database/naming-strategy';

/**
 * How one table's rows are written as JSON by Postgres itself, so that what a reader parses is
 * exactly what the `pg` row parser followed by `NamingStrategy.denormalizeRecord` would have handed it.
 *
 * Every column is named by its camelCase field name (the same `toCamelCase` the denormalizer uses)
 * and in table order, so keys come out in the order `SELECT *` gives. A column's JSON form is only
 * used where it equals the parsed one; where it does not, the column is cast to text and the reader
 * converts it the way the parser does (`revive`):
 *
 *   text, varchar, char, uuid, enum   string — same
 *   integer, smallint                 number — same
 *   boolean                           true/false — same
 *   json, jsonb                       the value itself, nested — same as `JSON.parse` of its text
 *   numeric, bigint                   cast to text: the parser hands these back as strings
 *   real, double precision            cast to text, read with `parseFloat` — JSON has no NaN/Infinity
 *   timestamptz                       ISO text, read into a `Date` exactly as `pg-types` reads it
 *
 * Any other type — a date or timestamp without a zone (read in the READING process's local zone), an
 * array, bytea, interval, a domain — and the table has no shape: its rows take the ordinary path.
 *
 * The shape is remembered per table, so it carries the table's column `signature`, and every
 * statement re-reads the current one: a column added, dropped or retyped by another process makes the
 * answer unusable, and the reader falls back instead of returning rows of an older shape.
 */
export class JsonRowShape {
  private static readonly AS_IS = new Set([25, 1043, 1042, 2950, 23, 21, 16, 114, 3802]);
  private static readonly AS_TEXT = new Set([1700, 20]);
  private static readonly AS_FLOAT = new Set([700, 701]);
  private static readonly TIMESTAMPTZ = 1184;
  private static readonly IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

  /** The columns of a table, in order, with their type and the table's signature. `$1` is the table name. */
  static readonly COLUMNS_SQL = `SELECT a.attname AS name, a.atttypid::int AS type, t.typtype AS kind,
      md5(string_agg(a.attname || ':' || a.atttypid, ',') OVER (ORDER BY a.attnum ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)) AS signature
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum`;

  private constructor(
    private readonly tableName: string,
    private readonly parts: ReadonlyArray<{ key: string; sql: string }>,
    readonly revive: Record<string, 'timestamp' | 'float'>,
    readonly signature: string,
  ) {}

  /** The shape for `tableName`'s columns (rows of `COLUMNS_SQL`), or null when one has no exact JSON form. */
  static of(tableName: string, columns: Array<{ name: string; type: number; kind: string; signature: string }>): JsonRowShape | null {
    if (!columns.length || !JsonRowShape.IDENTIFIER.test(tableName)) return null;
    const parts: Array<{ key: string; sql: string }> = [];
    const revive: Record<string, 'timestamp' | 'float'> = {};
    for (const { name, type, kind } of columns) {
      if (!JsonRowShape.IDENTIFIER.test(name)) return null;
      const key = NamingStrategy.toCamelCase(name);
      const column = `r."${name}"`;
      if (JsonRowShape.AS_IS.has(type) || kind === 'e') {
        parts.push({ key, sql: `${column} AS "${key}"` });
      } else if (JsonRowShape.AS_TEXT.has(type)) {
        parts.push({ key, sql: `${column}::text AS "${key}"` });
      } else if (JsonRowShape.AS_FLOAT.has(type)) {
        parts.push({ key, sql: `${column}::text AS "${key}"` });
        revive[key] = 'float';
      } else if (type === JsonRowShape.TIMESTAMPTZ) {
        parts.push({ key, sql: `${column} AS "${key}"` });
        revive[key] = 'timestamp';
      } else {
        return null;
      }
    }
    return new JsonRowShape(tableName, parts, revive, String(columns[0].signature));
  }

  /**
   * `inner` (a `SELECT * ... ORDER BY ... LIMIT ...` on this table) re-read as one JSON text per row,
   * each with the table's CURRENT signature beside it — computed once per statement. The outer selects
   * only project, so rows keep the order the inner statement produced. `omit` names fields (camelCase)
   * left out of each row.
   */
  statement(inner: string, omit: readonly string[] = []): string {
    const select = this.parts.filter((part) => !omit.includes(part.key)).map((part) => part.sql).join(', ');
    const current = `(SELECT md5(string_agg(a.attname || ':' || a.atttypid, ',' ORDER BY a.attnum)) FROM pg_attribute a`
      + ` WHERE a.attrelid = 'public."${this.tableName}"'::regclass AND a.attnum > 0 AND NOT a.attisdropped)`;
    return `SELECT row_to_json(j)::text, ${current} FROM (SELECT ${select} FROM (${inner}) r) j`;
  }
}
