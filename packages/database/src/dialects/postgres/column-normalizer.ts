import { Pool } from 'pg';
import { DialectColumnNormalizer } from '@database/dialects/dialect-column-normalizer';
import { NamingStrategy } from '@database/naming-strategy';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';

/**
 * PostgresColumnNormalizer - Postgres-specific column metadata lookup.
 */
/**
 * Column metadata for the where/write normalizers, cached per table.
 *
 * The lookup runs on the REQUEST'S OWN connection when a tenant scope is open, never on a second
 * pooled client. It used to go straight to the pool: a scope already holding its client then needed a
 * SECOND one for the column lookup, and with ten concurrent scopes (ten storefront requests, or ten
 * plugin-guest callbacks) every client was held and every lookup waited for an eleventh — the whole
 * api stopped until restarted. Table metadata is not row-secured, so the scoped client sees it fine.
 */
export class PostgresColumnNormalizer extends DialectColumnNormalizer {
  private pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  private get executor(): { query: (text: string, values?: any[]) => Promise<any> } {
    return (TenantConnectionScope.currentClient(this.pool) as any) ?? this.pool;
  }

  protected async getColumnTypes(tableName: string): Promise<Map<string, string>> {
    const cached = this.columnTypesCache.get(tableName);
    if (cached) return cached;

    const result = await this.executor.query(
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
