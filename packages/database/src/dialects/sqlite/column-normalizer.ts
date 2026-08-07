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

  protected normalizeParamValue(value: any): any {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return SqliteDateUtils.toSafeIsoDate(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }
}
