import Database from 'better-sqlite3';
import { DialectColumnNormalizer } from './dialect-column-normalizer';
import { SqliteDateUtils } from './sqlite-date-utils';

/**
 * SqliteColumnNormalizer - SQLite-specific JSON-column lookup and value coercion.
 */
export class SqliteColumnNormalizer extends DialectColumnNormalizer {
  private sqlite: Database.Database;

  constructor(sqlite: Database.Database) {
    super();
    this.sqlite = sqlite;
  }

  protected async getJsonColumns(tableName: string): Promise<Set<string>> {
    const cached = this.jsonColumnsCache.get(tableName);
    if (cached) return cached;

    const rows = this.sqlite.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all() as any[];
    const columns = new Set(
      (rows || [])
        .filter((row: any) => String(row?.type || '').toUpperCase().includes('JSON'))
        .map((row: any) => String(row?.name || '').toLowerCase())
    );
    this.jsonColumnsCache.set(tableName, columns);
    return columns;
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
