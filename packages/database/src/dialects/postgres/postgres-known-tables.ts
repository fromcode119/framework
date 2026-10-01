import { Sql } from '@database/sql/sql';
import { SqlRenderer } from '@database/sql/sql-renderer';

/**
 * Tables seen to exist. The first-boot guard asked the catalog before EVERY read — half of all
 * statements a request ran. A table that exists keeps existing; one that did not may be created later,
 * so only "yes" is remembered, and a read that finds a remembered table gone forgets it (see `dropped`).
 */
export class PostgresKnownTables {
  private static readonly UNDEFINED_TABLE = '42P01';

  private readonly known = new Set<string>();

  /** `executor` runs the catalog query on the request's connection. */
  constructor(private readonly executor: () => { query(text: string, values?: unknown[]): Promise<any> }) {}

  async exists(tableName: string): Promise<boolean> {
    if (this.known.has(tableName)) return true;
    const { text, params } = SqlRenderer.POSTGRES.render(Sql.query`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`);
    const result: any = await this.executor().query(text, params);
    const exists = (result.rows[0]?.total || 0) > 0;
    if (exists) this.known.add(tableName);
    return exists;
  }

  /** True when `error` says a remembered table no longer exists; the table is forgotten, as the guard would answer. */
  dropped(error: unknown, tableName: string): boolean {
    if ((error as { code?: unknown } | null)?.code !== PostgresKnownTables.UNDEFINED_TABLE) return false;
    this.known.delete(tableName);
    return true;
  }
}
