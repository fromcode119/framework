import type { Pool } from 'mysql2/promise';
import { DialectColumnNormalizer } from '@database/dialects/dialect-column-normalizer';
import { NamingStrategy } from '@database/naming-strategy';

/**
 * MysqlColumnNormalizer - MySQL-specific column metadata lookup.
 */
export class MysqlColumnNormalizer extends DialectColumnNormalizer {
  private pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  protected async getColumnTypes(tableName: string): Promise<Map<string, string>> {
    const cached = this.columnTypesCache.get(tableName);
    if (cached) return cached;

    const [rows]: any = await this.pool.execute(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?`,
      [tableName]
    );
    const types = new Map<string, string>(
      (rows || []).map((row: any) => [
        String(row?.column_name || '').toLowerCase(),
        String(row?.data_type || '').toUpperCase(),
      ])
    );
    this.columnTypesCache.set(tableName, types);
    return types;
  }

  protected normalizeParamValue(value: any): any {
    return NamingStrategy.normalizeParamValue(value);
  }
}
