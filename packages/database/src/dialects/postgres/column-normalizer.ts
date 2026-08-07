import { Pool } from 'pg';
import { DialectColumnNormalizer } from '@database/dialects/dialect-column-normalizer';
import { NamingStrategy } from '@database/naming-strategy';

/**
 * PostgresColumnNormalizer - Postgres-specific column metadata lookup.
 */
export class PostgresColumnNormalizer extends DialectColumnNormalizer {
  private pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  protected async getColumnTypes(tableName: string): Promise<Map<string, string>> {
    const cached = this.columnTypesCache.get(tableName);
    if (cached) return cached;

    const result = await this.pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1`,
      [tableName]
    );

    const types = new Map<string, string>(
      (result.rows || []).map((row: any) => [
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
