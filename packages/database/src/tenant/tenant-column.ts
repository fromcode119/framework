/**
 * The name of the column that carries row ownership.
 *
 * Dialect-NEUTRAL on purpose, which is why it lives here rather than with the Postgres isolation
 * SQL. Row-level security is Postgres-only, but the column is not: the sqlite and mysql branches of
 * migrations 030 and 021 add the bare column too, so the two dialects hold the same shape and a
 * database can be moved between them. Everything that renders SQL *around* this name belongs to a
 * dialect; the name itself does not.
 */
export class TenantColumn {
  static readonly NAME = 'tenant_id';
}
