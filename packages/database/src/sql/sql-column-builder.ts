import { SqlColumn } from '@database/sql/sql-column';
import type { SqlColumnType } from '@database/sql/sql-column-type';
import { Sql } from '@database/sql/sql';

/** Declares a column — `SqlColumns.text('email').notNull().unique()` — built when its table is defined. */
export class SqlColumnBuilder {
  private notNullFlag = false;
  private primaryFlag = false;
  private uniqueFlag = false;
  private hasDefaultFlag = false;
  private defaultValue: unknown = undefined;
  private defaultFn: (() => unknown) | undefined = undefined;
  private onUpdateFn: (() => unknown) | undefined = undefined;

  constructor(private readonly name: string | undefined, private readonly type: SqlColumnType, private readonly withTimezone = false) {}

  notNull(): this { this.notNullFlag = true; return this; }
  /** A primary key is NOT NULL. */
  primaryKey(): this { this.primaryFlag = true; this.notNullFlag = true; return this; }
  unique(): this { this.uniqueFlag = true; return this; }
  default(value: unknown): this { this.defaultValue = value; this.hasDefaultFlag = true; return this; }
  defaultNow(): this { return this.default(Sql.query`now()`); }
  defaultRandom(): this { return this.default(Sql.query`gen_random_uuid()`); }
  /** Documents the referenced column; the constraint itself is created by the migrations. */
  references(_target: () => unknown, _actions?: Record<string, unknown>): this { return this; }
  $defaultFn(fn: () => unknown): this { this.defaultFn = fn; this.hasDefaultFlag = true; return this; }
  $onUpdate(fn: () => unknown): this { this.onUpdateFn = fn; this.hasDefaultFlag = true; return this; }

  /** The column, named as declared or else by its field `key`. */
  build(key: string): SqlColumn {
    const column = new SqlColumn(this.name ?? key, this.type, this.withTimezone);
    column.notNull = this.notNullFlag;
    column.primary = this.primaryFlag;
    column.isUnique = this.uniqueFlag;
    column.hasDefault = this.hasDefaultFlag;
    column.default = this.defaultValue;
    column.defaultFn = this.defaultFn;
    column.onUpdateFn = this.onUpdateFn;
    return column;
  }
}
