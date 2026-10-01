import { SqlColumnBuilder } from '@database/sql/sql-column-builder';
import { SqlColumnType } from '@database/sql/sql-column-type';

/** The column types a table can declare. A name may be omitted; the field's key is used. */
export class SqlColumns {
  static text(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.TEXT); }
  static varchar(name?: string, _config?: { length?: number }): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.TEXT); }
  static uuid(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.UUID); }
  static boolean(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.BOOLEAN); }
  static serial(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.SERIAL).notNull(); }
  static integer(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.INTEGER); }
  static real(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.REAL); }
  static numeric(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.NUMERIC); }
  static json(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.JSON); }
  static jsonb(name?: string): SqlColumnBuilder { return new SqlColumnBuilder(name, SqlColumnType.JSONB); }

  /** `mode: 'string'` keeps the text Postgres sent; otherwise a `Date`. */
  static timestamp(name?: string, config: { withTimezone?: boolean; mode?: string } = {}): SqlColumnBuilder {
    return new SqlColumnBuilder(name, config.mode === 'string' ? SqlColumnType.TIMESTAMP_STRING : SqlColumnType.TIMESTAMP, config.withTimezone ?? false);
  }

  /** `mode: 'date'` decodes to a `Date`; otherwise the `YYYY-MM-DD` text. */
  static date(name?: string, config: { mode?: string } = {}): SqlColumnBuilder {
    return new SqlColumnBuilder(name, config.mode === 'date' ? SqlColumnType.DATE : SqlColumnType.DATE_STRING);
  }
}
