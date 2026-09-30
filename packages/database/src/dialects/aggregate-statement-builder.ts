import type { IRawStatementHooks } from '@database/interfaces/raw-statement-hooks.interface';
import type { IAggregateOptions } from '@database/interfaces/aggregate-options.interface';
import { AggregateBucketUnit } from '@database/enums/aggregate-bucket-unit.enum';
import { AggregateFunction } from '@database/enums/aggregate-function.enum';
import { SortDirection } from '@database/enums/sort-direction.enum';

/**
 * `aggregate` — grouped SQL aggregation with several measures, time buckets and an order.
 *
 * `groupCount` answers "how many per group"; a reporting screen also needs "how many DISTINCT",
 * sums, averages and calendar buckets in the site's own time zone. Paging rows into memory to compute
 * those is what put a ceiling on every analytics screen, so the database computes them instead.
 *
 * Every caller-supplied name reaches SQL as code, so each one is checked: fields go through the
 * dialect's identifier sanitiser, result keys must be plain identifiers, functions and units must
 * resolve to their Enum, and a time zone must be one the runtime itself knows.
 *
 * Functions, units and directions are resolved from their `.value`, because that is what arrives from a
 * sandboxed plugin: an Enum crosses the process boundary as its string.
 */
export class AggregateStatementBuilder {
  private static readonly PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

  /** The key a bucketed timestamp is returned under. */
  static readonly BUCKET_KEY = 'bucket';

  constructor(
    private readonly hooks: IRawStatementHooks,
    private readonly buildFilter: (where: any) => { sql: string; values: any[] },
  ) {}

  /** A time zone the runtime recognises, or `UTC`. Anything else is rejected — it is interpolated. */
  static validTimeZone(value: unknown): string {
    const zone = String(value ?? '').trim() || 'UTC';
    if (zone === 'UTC') return zone;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
    } catch {
      throw new Error(`Invalid time zone: ${JSON.stringify(zone)}`);
    }
    if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(zone)) throw new Error(`Invalid time zone: ${JSON.stringify(zone)}`);
    return zone;
  }

  build(tableName: string, options: IAggregateOptions): { sql: string; values: any[] } {
    const measures = options.measures ?? [];
    if (measures.length === 0) throw new Error('aggregate needs at least one measure.');

    const select: string[] = [];
    const group: string[] = [];
    const keys = new Set<string>();

    for (const field of options.groupBy ?? []) {
      const name = this.plainName(field, 'groupBy');
      const column = this.hooks.quoteIdentifier(field);
      select.push(`${column} AS "${name}"`);
      group.push(column);
      keys.add(name);
    }

    if (options.bucket) {
      const unit = AggregateBucketUnit.fromValue(String(options.bucket.unit));
      if (!unit) throw new Error(`Invalid bucket unit: ${JSON.stringify(String(options.bucket.unit))}`);
      const expression = this.hooks.bucketExpression(
        this.hooks.quoteIdentifier(options.bucket.column),
        unit,
        AggregateStatementBuilder.validTimeZone(options.bucket.timeZone),
      );
      select.push(`${expression} AS "${AggregateStatementBuilder.BUCKET_KEY}"`);
      group.push(expression);
      keys.add(AggregateStatementBuilder.BUCKET_KEY);
    }

    for (const measure of measures) {
      const name = this.plainName(measure.as, 'measure');
      if (keys.has(name)) throw new Error(`Duplicate aggregate key: ${JSON.stringify(name)}`);
      select.push(`${this.measureExpression(AggregateStatementBuilder.functionOf(measure.fn), measure.column)} AS "${name}"`);
      keys.add(name);
    }

    const { sql: whereSql, values } = this.buildFilter(options.where);
    let statement = `SELECT ${select.join(', ')} FROM "${tableName}"${whereSql}`;
    if (group.length > 0) statement += ` GROUP BY ${group.join(', ')}`;
    statement += ` ORDER BY ${this.orderClause(options, keys)}`;
    if (options.limit) statement += ` LIMIT ${Math.max(1, Math.floor(Number(options.limit)))}`;
    if (options.offset) statement += ` OFFSET ${Math.max(0, Math.floor(Number(options.offset)))}`;
    return { sql: statement, values };
  }

  /** Measures come back from drivers as strings (Postgres numerics); a report wants numbers. */
  static coerceRow(row: Record<string, unknown>, options: IAggregateOptions): Record<string, unknown> {
    const out = { ...row };
    for (const measure of options.measures) {
      const value = out[measure.as];
      if (value === null || value === undefined) {
        out[measure.as] = AggregateStatementBuilder.functionOf(measure.fn).emptyValue;
      } else {
        out[measure.as] = Number(value);
      }
    }
    return out;
  }

  private static functionOf(fn: unknown): AggregateFunction {
    const resolved = AggregateFunction.fromValue(String(fn));
    if (!resolved) throw new Error(`Invalid aggregate function: ${JSON.stringify(String(fn))}`);
    return resolved;
  }

  private measureExpression(fn: AggregateFunction, column?: string): string {
    if (!column) {
      if (fn !== AggregateFunction.COUNT) throw new Error(`Aggregate "${fn.value}" needs a column.`);
      return 'COUNT(*)';
    }
    const quoted = this.hooks.quoteIdentifier(column);
    return fn === AggregateFunction.COUNT_DISTINCT ? `COUNT(DISTINCT ${quoted})` : `${fn.sql}(${quoted})`;
  }

  private orderClause(options: IAggregateOptions, keys: Set<string>): string {
    const requested = options.orderBy?.by;
    if (requested) {
      const name = this.plainName(requested, 'orderBy');
      if (!keys.has(name)) throw new Error(`orderBy ${JSON.stringify(name)} is not a returned key.`);
      const direction = SortDirection.fromValue(String(options.orderBy?.direction ?? SortDirection.DESC).toUpperCase());
      if (!direction) throw new Error(`Invalid orderBy direction: ${JSON.stringify(String(options.orderBy?.direction))}`);
      return `"${name}" ${direction.value}`;
    }
    if (options.bucket) return `"${AggregateStatementBuilder.BUCKET_KEY}" ASC`;
    return `"${options.measures[0].as}" DESC`;
  }

  private plainName(value: unknown, role: string): string {
    const name = String(value ?? '');
    if (!AggregateStatementBuilder.PLAIN_NAME.test(name)) throw new Error(`Invalid ${role} name: ${JSON.stringify(name)}`);
    return name;
  }
}
