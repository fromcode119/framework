import type { Pool } from 'mysql2/promise';
import { DialectColumnNormalizer } from '../dialect-column-normalizer';
import { NamingStrategy } from '../../naming-strategy';

/**
 * MysqlColumnNormalizer - MySQL-specific JSON column lookup.
 */
export class MysqlColumnNormalizer extends DialectColumnNormalizer {
  private pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  protected async getJsonColumns(tableName: string): Promise<Set<string>> {
    const cached = this.jsonColumnsCache.get(tableName);
    if (cached) return cached;

    const [rows]: any = await this.pool.execute(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND data_type = 'json'`,
      [tableName]
    );
    const columns: Set<string> = new Set<string>(
      (rows || []).map((row: any) => String(row?.column_name || '').toLowerCase())
    );
    this.jsonColumnsCache.set(tableName, columns);
    return columns;
  }

  protected normalizeParamValue(value: any): any {
    return NamingStrategy.normalizeParamValue(value);
  }
}
