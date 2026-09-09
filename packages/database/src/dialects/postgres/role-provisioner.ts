import { DatabaseRoleOutcome } from '@database/roles/database-role-outcome';
import type { DatabaseRolePlan } from '@database/roles/database-role-plan';

/**
 * Creating and realigning the deployment's PostgreSQL logins, and granting the runtime role its
 * privileges.
 *
 * Split out of PostgresDatabaseManager (429 lines) 2026-09-09. It needs ONE capability — running SQL —
 * so it takes that as a function rather than a back-reference to the manager, which keeps the role SQL
 * (and its `format()`-based quoting) readable on its own.
 *
 * NOSUPERUSER / NOBYPASSRLS on the runtime role is the point of the exercise: a superuser bypasses
 * row-level security unconditionally, which would make every policy decorative.
 */
export class PostgresRoleProvisioner {
  constructor(private readonly run: (sqlText: string, values?: unknown[]) => Promise<Array<Record<string, unknown>>>) {}

  /**
   * Creates or realigns the deployment's logins.
   *
   * Every identifier and password goes through the server's own `format()` with `%I`/`%L`, so a role
   * name or a password containing a quote is quoted by PostgreSQL rather than by string building here.
   *
   * The attributes are the point of the whole exercise: NOSUPERUSER and NOBYPASSRLS on the runtime role
   * are what make row-level security apply to it at all. A superuser bypasses policies unconditionally
   * and an owner bypasses them on any table missing FORCE — in both cases every query still succeeds
   * and isolation is simply absent, with nothing to notice.
   */
  async provisionRoles(plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome> {
    const roles = plan.isSingleRole ? [plan.owner] : [plan.owner, plan.runtime];

    for (const role of roles) {
      await this.runFormatted(
        'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
        [role.name, role.password],
        'NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)',
      );
      // Always realign an existing role: a password rotated in the connection string has to reach the
      // database, and an attribute someone widened by hand has to come back.
      await this.runFormatted(
        'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
        [role.name, role.password],
      );
      await this.runFormatted('GRANT CONNECT ON DATABASE %I TO %I', [plan.database, role.name]);
    }

    // PostgreSQL 15 removed PUBLIC's CREATE on the `public` schema, so the owner must be granted it
    // explicitly or the very first migration fails with "permission denied for schema public".
    await this.runFormatted('GRANT USAGE, CREATE ON SCHEMA public TO %I', [plan.owner.name]);
    if (!plan.isSingleRole) {
      await this.runFormatted('GRANT USAGE ON SCHEMA public TO %I', [plan.runtime.name]);
    }

    // Table and sequence privileges are deliberately NOT set here: they belong to whoever owns the
    // tables, which is the migration role, and they must be reapplied after every migration rather than
    // once at provisioning time. AppRoleGrantService does that on the owner connection each boot.
    return DatabaseRoleOutcome.applied(roles.map(role => role.name));
  }


  /**
   * Grants the runtime role rights over what this owner has created, and will create.
   *
   * `ON ALL TABLES` covers what exists now; `ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER` covers what
   * this role creates later. Naming CURRENT_USER rather than a configured owner is the point: privileges
   * attach to the role that creates an object, and the deployment's init script used to name the
   * superuser while migrations actually ran as a different role — so every migrated table came out
   * unreadable by the app.
   */
  async grantRuntimePrivileges(role: string): Promise<DatabaseRoleOutcome> {
    await this.runFormatted('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', [role]);
    await this.runFormatted('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', [role]);
    await this.runFormattedWithCurrentUser(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
      role,
    );
    await this.runFormattedWithCurrentUser(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
      role,
    );
    return DatabaseRoleOutcome.applied([role]);
  }


  /** As `runFormatted`, with CURRENT_USER as the first `%I` — the role whose future objects are covered. */
  private async runFormattedWithCurrentUser(template: string, role: string): Promise<void> {
    const rows = await this.run(
      `SELECT format($f$${template}$f$, CURRENT_USER, $1::text) AS statement`,
      [role],
    );
    const statement = rows?.[0]?.statement;
    if (statement) await this.run(String(statement));
  }


  /**
   * Builds a DDL statement with the server's own `format()`, then executes what it returned.
   *
   * DDL takes no bind parameters and a `DO $$ … $$` body is an opaque string, so `$1` inside one is not
   * a parameter at all — the driver rejects it with "bind message supplies N parameters, but prepared
   * statement requires 0". Doing it in two steps keeps the quoting where it belongs: `%I` and `%L` are
   * applied by PostgreSQL to bound values, so a role name or password containing a quote is escaped by
   * the server rather than by string building here. `when` is an optional SQL predicate over the same
   * parameters; the statement is produced, and therefore run, only if it holds.
   */
  private async runFormatted(template: string, values: string[], when?: string): Promise<void> {
    const placeholders = values.map((_value, index) => `$${index + 1}::text`).join(', ');
    const rows = await this.run(
      `SELECT format($f$${template}$f$, ${placeholders}) AS statement${when ? ` WHERE ${when}` : ''}`,
      values,
    );
    const statement = rows?.[0]?.statement;
    if (statement) {
      await this.run(String(statement));
    }
  }
}
