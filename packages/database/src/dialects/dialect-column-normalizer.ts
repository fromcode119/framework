import { NamingStrategy } from '../naming-strategy';

/**
 * DialectColumnNormalizer - Shared JSON-column-aware value normalization.
 *
 * Owns the per-table JSON-column cache and the data/where normalization used by
 * every dialect's string-table CRUD path. Each concrete dialect implements
 * getJsonColumns() (the information_schema / PRAGMA lookup differs per engine)
 * and normalizeParamValue() (SQLite coerces Date/boolean differently).
 */
export abstract class DialectColumnNormalizer {
  protected jsonColumnsCache = new Map<string, Set<string>>();

  protected abstract getJsonColumns(tableName: string): Promise<Set<string>>;

  protected abstract normalizeParamValue(value: any): any;

  invalidateTableCache(tableName: string): void {
    this.jsonColumnsCache.delete(tableName);
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

  async normalizeColumnValueForWrite(tableName: string, column: string, value: any): Promise<any> {
    const jsonColumns = await this.getJsonColumns(tableName);
    const normalizedColumn = NamingStrategy.toSnakeCase(column).toLowerCase();
    if (jsonColumns.has(normalizedColumn)) {
      return this.normalizeJsonColumnValue(value);
    }
    return this.normalizeParamValue(value);
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
      normalized[column] = await this.normalizeColumnValueForWrite(tableName, column, value);
    }
    return normalized;
  }
}
