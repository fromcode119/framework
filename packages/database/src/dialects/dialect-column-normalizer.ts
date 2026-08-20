import { NamingStrategy } from '@database/naming-strategy';
import { UnknownColumnError } from '@database/dialects/unknown-column-error';
import { WhereClauseParser } from '@database/dialects/where-clause-parser';

/**
 * DialectColumnNormalizer - Shared per-table column metadata and value normalization.
 *
 * Owns ONE per-table metadata read (name -> declared type) and derives every consumer from it:
 * the JSON-column set used by the write path, and the physical column set used to resolve and
 * VALIDATE caller-supplied field names. Each concrete dialect implements only `getColumnTypes()`
 * (PRAGMA on SQLite, information_schema on Postgres/MySQL) and `normalizeParamValue()` (SQLite
 * coerces Date/boolean differently).
 */
export abstract class DialectColumnNormalizer {
  /** Physical column name (lower-cased) -> declared type (upper-cased), per table. */
  protected columnTypesCache = new Map<string, Map<string, string>>();

  protected abstract getColumnTypes(tableName: string): Promise<Map<string, string>>;

  protected abstract normalizeParamValue(value: any, declaredType?: string): any;

  invalidateTableCache(tableName: string): void {
    this.columnTypesCache.delete(tableName);
  }

  /** Columns declared with a JSON/JSONB type, derived from the shared metadata read. */
  protected async getJsonColumns(tableName: string): Promise<Set<string>> {
    const types = await this.getColumnTypes(tableName);
    const jsonColumns = new Set<string>();
    for (const [name, type] of types) {
      if (type.includes('JSON')) jsonColumns.add(name);
    }
    return jsonColumns;
  }

  protected normalizeJsonColumnValue(value: any): any {
    if (value === undefined || value === null) return null;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return JSON.stringify(value);
      try {
        JSON.parse(trimmed);
        return trimmed;
      } catch {
        return JSON.stringify(value);
      }
    }

    return JSON.stringify(value);
  }

  /**
   * Declared types for which an empty string is not a value but an ABSENT one. Postgres rejects `''`
   * for every one of them, so it can only ever be an error — `invalid input syntax for type date: ""`.
   */
  private static readonly EMPTY_STRING_MEANS_NULL = /DATE|TIME|INT|NUMERIC|DECIMAL|REAL|DOUBLE|FLOAT|BOOL|UUID/;

  /**
   * An empty string reaching a non-text column means the operator CLEARED the field, not that they typed
   * the empty string — no admin control can produce `''` for a datepicker or a number input.
   *
   * Postgres is strict where SQLite is not: saving a person with a blank birth date sent `''` at a `date`
   * column and the whole request died with a 400 (`invalid input syntax for type date: ""`), so the record
   * could not be saved at all until some unrelated date was invented. Resolved here rather than at each
   * call site because this is the one layer that knows the column's declared type.
   */
  private async coerceEmptyStringForColumn(tableName: string, physicalColumn: string, value: any): Promise<any | undefined> {
    if (typeof value !== 'string' || value.trim() !== '') return undefined;
    const types = await this.getColumnTypes(tableName).catch(() => new Map<string, string>());
    const declaredType = types.get(physicalColumn) || '';
    return DialectColumnNormalizer.EMPTY_STRING_MEANS_NULL.test(declaredType) ? null : undefined;
  }

  async normalizeColumnValueForWrite(tableName: string, column: string, value: any): Promise<any> {
    const jsonColumns = await this.getJsonColumns(tableName);
    const normalizedColumn = NamingStrategy.toSnakeCase(column).toLowerCase();
    if (jsonColumns.has(normalizedColumn)) {
      return this.normalizeJsonColumnValue(value);
    }
    const cleared = await this.coerceEmptyStringForColumn(tableName, normalizedColumn, value);
    if (cleared === null) return null;
    const types = await this.getColumnTypes(tableName).catch(() => new Map<string, string>());
    return this.normalizeParamValue(value, types.get(normalizedColumn));
  }

  async normalizeDataForTable(tableName: string, data: any): Promise<any> {
    const normalized: Record<string, any> = {};
    for (const [column, value] of Object.entries(data || {})) {
      normalized[column] = await this.normalizeColumnValueForWrite(tableName, column, value);
    }
    return normalized;
  }

  async normalizeWhereForTable(tableName: string, where: any): Promise<any> {
    if (!where || typeof where !== 'object' || Object.getPrototypeOf(where) !== Object.prototype) {
      return where;
    }
    const normalized: Record<string, any> = {};
    for (const [column, value] of Object.entries(where)) {
      // An operator expression is STRUCTURE, not a value: normalizing it whole would JSON-stringify
      // `{ gte, lte }` into a string and the range would silently become an equality against that
      // JSON text, matching nothing. Normalize each OPERAND and keep the shape.
      if (WhereClauseParser.isOperatorExpression(column, value)) {
        const operators: Record<string, any> = {};
        for (const [operator, operand] of Object.entries(value as Record<string, any>)) {
          operators[operator] = await this.normalizeColumnValueForWrite(tableName, column, operand);
        }
        normalized[column] = operators;
        continue;
      }
      normalized[column] = await this.normalizeColumnValueForWrite(tableName, column, value);
    }
    return normalized;
  }

  /**
   * Resolve caller-supplied field names to REAL physical columns of `tableName`, or throw.
   *
   * Callers pass CANONICAL camelCase schema field names; the physical columns are snake_case. A name
   * that resolves to no column must never reach SQL: SQLite does not reject an unknown double-quoted
   * identifier, it degrades it to a STRING LITERAL, so `"affiliateCode" LIKE '%AFF%'` compares the
   * column NAME as text and matches EVERY row. Failing here turns that silent wrong answer into a loud
   * error. Validation doubles as the injection gate — an interpolated name that is not a known column
   * cannot get through.
   *
   * When the table has no readable metadata (not created yet, or the caller passed a collection slug
   * that is not a physical table), there is nothing to validate against, so the snake_cased name is
   * returned and the query itself reports the missing table.
   */
  async resolveColumnsForTable(tableName: string, columns: string[]): Promise<string[]> {
    const types = await this.getColumnTypes(tableName).catch(() => new Map<string, string>());
    return columns.map((column) => this.resolveOneColumn(tableName, column, types));
  }

  private resolveOneColumn(tableName: string, column: string, types: Map<string, string>): string {
    const requested = String(column ?? '');
    if (types.size === 0) return NamingStrategy.toSafeColumnIdentifier(requested);

    for (const candidate of [requested, NamingStrategy.toSnakeCase(requested)]) {
      const physical = candidate.toLowerCase();
      if (types.has(physical)) return physical;
    }

    throw new UnknownColumnError(tableName, requested, [...types.keys()]);
  }
}
