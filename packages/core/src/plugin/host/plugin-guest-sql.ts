import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * A drizzle `sql` template is an object graph of chunks, not data — it cannot cross to the host.
 * Plugin migrations write `db.execute(sql\`…\`)`, so the guest flattens the template to
 * `{ sql, params }` here and the host runs it as a parametrised statement.
 */
export class PluginGuestSql {
  private static readonly dialect = new PgDialect();

  static isSqlObject(value: unknown): boolean {
    return !!value && typeof value === 'object' && Array.isArray((value as any).queryChunks);
  }

  static flatten(value: unknown): { $sql: string; params: unknown[] } {
    const query = PluginGuestSql.dialect.sqlToQuery(value as any);
    return { $sql: query.sql, params: query.params as unknown[] };
  }

  /** Rewrites SQL objects among `args` so the whole list is clonable. */
  static portableArgs(args: unknown[]): unknown[] {
    return args.map((arg) => (PluginGuestSql.isSqlObject(arg) ? PluginGuestSql.flatten(arg) : arg));
  }
}
