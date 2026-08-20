import Database from 'better-sqlite3';
import { DialectColumnNormalizer } from '@database/dialects/dialect-column-normalizer';
import { SqliteDateUtils } from '@database/dialects/sqlite/date-utils';

/**
 * SqliteColumnNormalizer - SQLite-specific column metadata lookup and value coercion.
 */
export class SqliteColumnNormalizer extends DialectColumnNormalizer {
  private sqlite: Database.Database;

  constructor(sqlite: Database.Database) {
    super();
    this.sqlite = sqlite;
  }

  protected async getColumnTypes(tableName: string): Promise<Map<string, string>> {
    const cached = this.columnTypesCache.get(tableName);
    if (cached) return cached;

    const rows = this.sqlite.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all() as any[];
    const types = new Map<string, string>(
      (rows || []).map((row: any) => [
        String(row?.name || '').toLowerCase(),
        String(row?.type || '').toUpperCase(),
      ])
    );
    this.columnTypesCache.set(tableName, types);
    return types;
  }

  /** Declared column types with SQLite TEXT affinity (type name contains TEXT, CHAR, or CLOB). */
  private static readonly TEXT_AFFINITY = /TEXT|CHAR|CLOB/;

  protected normalizeParamValue(value: any, declaredType?: string): any {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return SqliteDateUtils.toSafeIsoDate(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'object') return JSON.stringify(value);
    // better-sqlite3 binds EVERY JS number via sqlite3_bind_double, so the integer 5 reaches a
    // TEXT-affinity column as REAL 5.0 and is stored as '5.0'. That silently corrupts id-like
    // strings ('5' → '5.0') and breaks every string-equality lookup on them — bind the canonical
    // string instead. Only at TEXT affinity: numeric columns must keep receiving real numbers.
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      declaredType &&
      SqliteColumnNormalizer.TEXT_AFFINITY.test(declaredType)
    ) {
      return String(value);
    }
    return value;
  }
}
