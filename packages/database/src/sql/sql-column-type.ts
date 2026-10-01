import type { SqlColumn } from '@database/sql/sql-column';

/**
 * A column's type: how a value is encoded for the driver and decoded from it. Each is the conversion
 * the Postgres driver setup expects — timestamps, dates and intervals arrive as the raw strings Postgres
 * sent (see `PostgresTableStatements.TYPES`) and are decoded here.
 */
export class SqlColumnType {
  static readonly TEXT = new SqlColumnType('text');
  static readonly UUID = new SqlColumnType('uuid');
  static readonly BOOLEAN = new SqlColumnType('boolean');
  static readonly SERIAL = new SqlColumnType('serial');
  static readonly INTEGER = new SqlColumnType('integer', (value) => (typeof value === 'string' ? Number.parseInt(value) : value));
  static readonly REAL = new SqlColumnType('real', (value) => (typeof value === 'string' ? Number.parseFloat(value) : value));
  /** Kept as the exact decimal string — a float would round money. */
  static readonly NUMERIC = new SqlColumnType('numeric', (value) => (typeof value === 'string' ? value : String(value)));
  static readonly JSON = new SqlColumnType('json', SqlColumnType.parseJson, (value) => JSON.stringify(value));
  static readonly JSONB = new SqlColumnType('jsonb', SqlColumnType.parseJson, (value) => JSON.stringify(value));
  /** A `Date`; a timestamp without time zone is read as UTC. */
  static readonly TIMESTAMP = new SqlColumnType(
    'timestamp',
    (value, column) => (typeof value === 'string' ? new Date(column.withTimezone ? value : `${value}+0000`) : value),
    (value) => (value as Date).toISOString(),
  );
  /** The text Postgres sent, as written. */
  static readonly TIMESTAMP_STRING = new SqlColumnType('timestamp', (value, column) => SqlColumnType.timestampText(value, column.withTimezone));
  static readonly DATE = new SqlColumnType('date', (value) => (typeof value === 'string' ? new Date(value) : value), (value) => (value as Date).toISOString());
  static readonly DATE_STRING = new SqlColumnType('date', (value) => (typeof value === 'string' ? value : (value as Date).toISOString().slice(0, -14)));

  private constructor(
    readonly name: string,
    readonly decode: (value: unknown, column: SqlColumn) => unknown = (value) => value,
    readonly encode: (value: unknown, column: SqlColumn) => unknown = (value) => value,
  ) {}

  private static parseJson(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private static timestampText(value: unknown, withTimezone: boolean): unknown {
    if (typeof value === 'string') return value;
    const date = value as Date;
    const shortened = date.toISOString().slice(0, -1).replace('T', ' ');
    if (!withTimezone) return shortened;
    const offset = date.getTimezoneOffset();
    return `${shortened}${offset <= 0 ? '+' : '-'}${Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0')}`;
  }
}
