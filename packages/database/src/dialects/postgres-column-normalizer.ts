import { Pool } from 'pg';
import { DialectColumnNormalizer } from './dialect-column-normalizer';
import { NamingStrategy } from '../naming-strategy';

/**
 * PostgresColumnNormalizer - Postgres-specific JSON/JSONB column lookup.
 */
export class PostgresColumnNormalizer extends DialectColumnNormalizer {
  private pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  protected async getJsonColumns(tableName: string): Promise<Set<string>> {
    const cached = this.jsonColumnsCache.get(tableName);
    if (cached) return cached;

    const result = await this.pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND data_type IN ('json', 'jsonb')`,
      [tableName]
    );

    const columns = new Set(
      (result.rows || []).map((row: any) => String(row?.column_name || '').toLowerCase())
    );
    this.jsonColumnsCache.set(tableName, columns);
    return columns;
  }

  protected normalizeParamValue(value: any): any {
    return NamingStrategy.normalizeParamValue(value);
  }
}
