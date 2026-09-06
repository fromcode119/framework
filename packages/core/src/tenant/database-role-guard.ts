import { sql } from '@fromcode119/database';

/**
 * Refuses to serve requests on a database connection that bypasses row-level security.
 *
 * Verified against Postgres 15: with `FORCE ROW LEVEL SECURITY` dropped, the table OWNER reads
 * every tenant's rows while `ENABLE` is still on; a SUPERUSER bypasses policies regardless of
 * FORCE. Both look completely healthy — every query succeeds, every page renders — and isolation is
 * simply absent. There is no symptom to notice, which is why this is a hard boot failure rather
 * than a warning.
 *
 * Postgres only: no other supported dialect has row-level security, so on those there is nothing to
 * assert and the check is skipped rather than faking a pass.
 */
export class DatabaseRoleGuard {
  private static readonly POSTGRES = 'postgres';

  static async assertNotPrivileged(db: {
    dialect?: string;
    execute: (query: unknown) => Promise<any>;
  }): Promise<void> {
    if (String(db?.dialect || '').toLowerCase() !== DatabaseRoleGuard.POSTGRES) return;

    const result = await db.execute(sql`
      SELECT
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
        EXISTS (
          SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user
        ) AS owns_tables
    `);
    const row = result?.rows?.[0];

    if (!row) {
      throw new Error(
        'DatabaseRoleGuard: could not determine the current database role. Refusing to boot — an '
        + 'unverified role may bypass row-level security.',
      );
    }
    if (row.is_superuser === true) {
      throw new Error(
        'DatabaseRoleGuard: the application is connected as a SUPERUSER, which bypasses row-level '
        + 'security and disables tenant isolation entirely. Connect as the non-owner runtime role '
        + '(DATABASE_URL), and run migrations as the owner (DATABASE_MIGRATION_URL).',
      );
    }
    if (row.owns_tables === true) {
      throw new Error(
        'DatabaseRoleGuard: the application is connected as a table OWNER, which bypasses row-level '
        + 'security on any table missing FORCE. Connect as the non-owner runtime role '
        + '(DATABASE_URL), and run migrations as the owner (DATABASE_MIGRATION_URL).',
      );
    }
  }
}
