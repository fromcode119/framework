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
   * The grant names the tables and sequences in `public` owned by a role this connection acts for;
   * `ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER` covers what this role creates later. Naming
   * CURRENT_USER rather than a configured owner is the point: privileges attach to the role that creates
   * an object, and the deployment's init script used to name the superuser while migrations actually ran
   * as a different role — so every migrated table came out unreadable by the app.
   *
   * Not `ON ALL TABLES IN SCHEMA`: that is one statement, so a single table some other role created (a
   * backup copied in by hand as the superuser) failed it with "permission denied for table …", and with
   * it the sequence grant and the default privileges after it, on every boot. Such objects are left out
   * and named in the outcome's note.
   */
  async grantRuntimePrivileges(role: string): Promise<DatabaseRoleOutcome> {
    await this.grantOnOwned(role, PostgresRoleProvisioner.TABLE_KINDS, 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO %I');
    await this.grantOnOwned(role, PostgresRoleProvisioner.SEQUENCE_KINDS, 'GRANT USAGE, SELECT ON SEQUENCE %s TO %I');
    await this.runFormattedWithCurrentUser(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
      role,
    );
    await this.runFormattedWithCurrentUser(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
      role,
    );
    const foreign = await this.run(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = ANY($1::"char"[]) AND NOT pg_has_role(current_user, c.relowner, 'USAGE')
       ORDER BY c.relname`,
      [[...PostgresRoleProvisioner.TABLE_KINDS, ...PostgresRoleProvisioner.SEQUENCE_KINDS]],
    );
    const names = foreign.map((row) => String(row.name));
    return DatabaseRoleOutcome.applied(
      [role],
      names.length ? `Left out ${names.length} object(s) another role owns, so this one cannot grant on them: ${names.join(', ')}.` : '',
    );
  }

  private static readonly TABLE_KINDS = ['r', 'p', 'v', 'm', 'f'];
  private static readonly SEQUENCE_KINDS = ['S'];

  /** One GRANT naming every object of these kinds in `public` whose owner this connection acts for. */
  private async grantOnOwned(role: string, kinds: string[], template: string): Promise<void> {
    const rows = await this.run(
      `SELECT format($f$${template}$f$, string_agg(format('public.%I', c.relname), ', ' ORDER BY c.relname), $1::text) AS statement
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = ANY($2::"char"[]) AND pg_has_role(current_user, c.relowner, 'USAGE')
       HAVING count(*) > 0`,
      [role, kinds],
    );
    const statement = rows?.[0]?.statement;
    if (statement) await this.run(String(statement));
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
