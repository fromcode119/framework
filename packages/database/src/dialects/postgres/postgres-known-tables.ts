import { sql } from 'drizzle-orm';

/**
 * Tables seen to exist. The first-boot guard asked the catalog before EVERY read — half of all
 * statements a request ran. A table that exists keeps existing; one that did not may be created later,
 * so only "yes" is remembered, and a read that finds a remembered table gone forgets it (see `dropped`).
 */
export class PostgresKnownTables {
  private static readonly UNDEFINED_TABLE = '42P01';

  private readonly known = new Set<string>();

  /** `orm` runs the catalog query on the request's connection. */
  constructor(private readonly orm: () => { execute(query: any): Promise<any> }) {}

  async exists(tableName: string): Promise<boolean> {
    if (this.known.has(tableName)) return true;
    const query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    const result: any = await this.orm().execute(query);
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
