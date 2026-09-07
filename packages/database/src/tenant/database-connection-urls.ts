/**
 * Which connection string each job uses.
 *
 * Tenant isolation needs the request path to run as a NON-OWNER, NON-SUPERUSER role, because an
 * owner connection bypasses row-level security on any table that is missing `FORCE`, and a
 * superuser bypasses it unconditionally. But DDL — migrations, collection schema sync — must run as
 * the role that OWNS the schema.
 *
 * Those are two different roles, so they are two different connection strings. `DATABASE_URL` is
 * the request path (least privilege); `DATABASE_MIGRATION_URL` is the DDL path. A deployment that
 * sets only `DATABASE_URL` keeps the old single-connection behaviour, which is correct for
 * single-tenant installs where there is no isolation to protect.
 */
export class DatabaseConnectionUrls {
  /** The connection the application serves requests on. Least privilege. */
  static runtime(): string {
    return String(process.env.DATABASE_URL || '');
  }

  /** The connection migrations and schema sync run on. Falls back to the runtime connection. */
  static migration(): string {
    return String(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL || '');
  }

  /**
   * The role name the application serves requests as, read out of `DATABASE_URL`.
   *
   * Nothing else needs to be configured to know it: the runtime connection string already names the
   * role, so a second environment variable saying the same thing could only ever disagree with it.
   */
  static runtimeRole(): string {
    try {
      return decodeURIComponent(new URL(DatabaseConnectionUrls.runtime()).username || '');
    } catch {
      return '';
    }
  }

  /** True when the deployment has actually separated the two roles. */
  static hasSeparateMigrationConnection(): boolean {
    const migration = String(process.env.DATABASE_MIGRATION_URL || '').trim();
    return migration.length > 0 && migration !== DatabaseConnectionUrls.runtime();
  }
}
