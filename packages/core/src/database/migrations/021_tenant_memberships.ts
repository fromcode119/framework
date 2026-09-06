import { BaseMigration, IDatabaseManager, TenantRlsSql, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Per-tenant identity: memberships, the `users` isolation policy, and tenant-scoped sessions.
 *
 * `users` stays a single GLOBAL table and is deliberately NOT tenant-scoped. It is the identity
 * service — email, credential, roles — and an account spans tenants by design, so login must be
 * able to find it before any tenant is known. Putting a policy on it would mean an untenanted login
 * lookup returned zero rows and nobody could ever sign in.
 *
 * The substantive personal data is not in `users`; it is in `people` and its siblings (names, email,
 * phone, addresses, relationships). Those ARE brought under the ordinary tenant policy here, which
 * closes a real hole: until now one tenant's contacts were readable by another.
 */
export class TenantMembershipsMigration extends BaseMigration {
  readonly version = 21;
  readonly name = 'Tenant memberships, tenant-scoped sessions and people';

  /** The tenant's record of a person — where the real PII lives, unlike the thin `users` row. */
  private static readonly PEOPLE_TABLES = [
    'people', 'people_addresses', 'person_relationships', 'person_catalogs',
  ];

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await TenantMembershipsMigration.createMembershipTable(
          db, { id: 'SERIAL PRIMARY KEY', json: 'JSONB', jsonDefault: "'[]'::jsonb", timestamp: 'TIMESTAMP' },
        );
        await TenantMembershipsMigration.addPlatformAdminFlag(db);

        // Memberships are NOT tenant-scoped, and that is the same rule as `users`: anything needed
        // to RESOLVE tenancy cannot itself be tenant-scoped, or the lookup is circular. This table
        // answers "which tenants may this account enter" — a question asked at login, before any
        // tenant is known. A policy here would return zero rows and nobody could ever sign in.
        //
        // Membership is authorization, not tenant content. Who belongs to which tenant is filtered
        // in the query layer for admin listings; the row itself carries no customer data.
        // Sessions record which tenant they belong to, but are NOT row-level-security scoped, and
        // that is deliberate rather than an omission.
        //
        // Validating a session is what TELLS us the tenant — so a policy here would be circular:
        // reading the session would require the tenant that only the session can supply. The binding
        // that matters is the signed tenant claim in the token itself (AuthManager.verifyToken),
        // which cannot be forged, plus a membership re-check on every request. Session LISTING in
        // the admin filters by this column in the query layer.
        //
        // Existing sessions are deleted: they carry no tenant claim, so they would be refused on the
        // next request anyway. Introducing tenancy logs everyone out, deliberately.
        await db.execute(sql.raw('DELETE FROM "_system_sessions"'));
        await db.execute(sql.raw('ALTER TABLE "_system_sessions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT'));
        await db.execute(sql.raw(
          'CREATE INDEX IF NOT EXISTS "_system_sessions_tenant_idx" ON "_system_sessions" ("tenant_id")',
        ));

        // A tenant's people are its own. These tables hold the real PII — until now they were
        // unscoped, so one tenant's contacts were readable by every other tenant.
        for (const table of TenantMembershipsMigration.PEOPLE_TABLES) {
          for (const statement of TenantRlsSql.statementsFor(table)) {
            await db.execute(sql.raw(statement));
          }
        }
      },
      sqlite: async () => {
        await TenantMembershipsMigration.createMembershipTable(
          db, { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', json: 'TEXT', jsonDefault: "'[]'", timestamp: 'DATETIME' },
        );
        await TenantMembershipsMigration.addPlatformAdminFlag(db);
        // No row-level security on SQLite; isolation there is file-per-tenant (see the S1 spec).
      },
    });
  }

  private static async createMembershipTable(
    db: IDatabaseManager,
    types: { id: string; json: string; jsonDefault: string; timestamp: string },
  ): Promise<void> {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "_system_tenant_memberships" (
        "id" ${types.id},
        "user_id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "roles" ${types.json} NOT NULL DEFAULT ${types.jsonDefault},
        "state" TEXT NOT NULL DEFAULT 'active',
        "created_at" ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
        "updated_at" ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "_system_tenant_memberships_unique" UNIQUE ("user_id", "tenant_id")
      )
    `));

    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_tenant_memberships_tenant_idx" '
      + 'ON "_system_tenant_memberships" ("tenant_id")',
    ));
  }

  /**
   * A platform admin is not a member of any tenant — the role sits on the account itself. It is what
   * makes provisioning and customer support possible, and it is the highest-value credential in the
   * system, so it defaults to FALSE and is granted deliberately.
   */
  private static async addPlatformAdminFlag(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_admin" BOOLEAN NOT NULL DEFAULT FALSE',
    ));
  }

}
