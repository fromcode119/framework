import { BaseMigration, IDatabaseManager, TenantRlsSql, sql } from '@fromcode119/database';
import { ColumnGuard } from '@core/database/helpers/column-guard';
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
          db, { id: 'SERIAL PRIMARY KEY', key: 'TEXT', json: 'JSONB', jsonDefault: "'[]'::jsonb", timestamp: 'TIMESTAMP' },
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
        await TenantMembershipsMigration.addSessionTenantColumn(db, 'TEXT');

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
          db, { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', key: 'TEXT', json: 'TEXT', jsonDefault: "'[]'", timestamp: 'DATETIME' },
        );
        await TenantMembershipsMigration.addPlatformAdminFlag(db);
        // The session column is NOT optional here, and leaving it out is what made SQLite unusable:
        // every session insert writes `tenant_id` whatever the driver, so without it nobody could
        // log in — the first-run wizard failed on "table _system_sessions has no column named
        // tenant_id" AFTER creating the administrator account.
        await TenantMembershipsMigration.addSessionTenantColumn(db, 'TEXT');
        // No row-level security on SQLite, and nothing replaces it — the file-per-tenant silo (S1,
        // 2026-09-04) was designed and NOT adopted; see its spec. Single-site only here.
      },
      mysql: async () => {
        // "user_id"/"tenant_id" carry the UNIQUE below (and "tenant_id" the index after it), so
        // neither can be TEXT here — same rule as everywhere else in this file's MySQL branch.
        // `roles` drops the JSON default MySQL refuses; the runtime writes '[]' on every insert.
        await TenantMembershipsMigration.createMembershipTable(
          db, { id: 'INT AUTO_INCREMENT PRIMARY KEY', key: 'VARCHAR(191)', json: 'JSON', jsonDefault: '', timestamp: 'TIMESTAMP NULL' },
        );
        await TenantMembershipsMigration.addPlatformAdminFlag(db);
        await TenantMembershipsMigration.addSessionTenantColumn(db, 'VARCHAR(191)');
        // No row-level security on MySQL, and nothing replaces it — `TenantMode` refuses to boot a
        // second tenant on this driver, so a deployment here is single-site only.
      },
    });
  }

  private static async createMembershipTable(
    db: IDatabaseManager,
    types: { id: string; key: string; json: string; jsonDefault: string; timestamp: string },
  ): Promise<void> {
    const rolesDefault = types.jsonDefault ? ` NOT NULL DEFAULT ${types.jsonDefault}` : '';
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "_system_tenant_memberships" (
        "id" ${types.id},
        "user_id" ${types.key} NOT NULL,
        "tenant_id" ${types.key} NOT NULL,
        "roles" ${types.json}${rolesDefault},
        "state" ${types.key} NOT NULL DEFAULT 'active',
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
    // Called from BOTH dialect branches, so it cannot use either dialect's exclusive syntax.
    await ColumnGuard.addIfMissing(db, 'users', 'is_platform_admin', 'BOOLEAN NOT NULL DEFAULT FALSE');
  }

  /**
   * Which tenant a session belongs to.
   *
   * Sessions record this but are NOT row-level-security scoped, and that is deliberate rather than an
   * omission: validating a session is what TELLS us the tenant, so a policy here would be circular —
   * reading the session would require the tenant only the session can supply. The binding that
   * matters is the signed tenant claim in the token (`AuthManager.verifyToken`), which cannot be
   * forged, plus a membership re-check on every request. Session LISTING in the admin filters by this
   * column in the query layer.
   *
   * Called from ALL THREE dialect branches — `ColumnGuard` asks each driver in its own words, because
   * SQLite has no `ADD COLUMN IF NOT EXISTS`. It lived only in the PostgreSQL branch until a SQLite
   * install was actually attempted, and the column is not optional: the runtime writes it on every
   * session insert regardless of driver.
   *
   * `keyType` is `TEXT` on Postgres/SQLite and `VARCHAR(191)` on MySQL — the CREATE INDEX below is
   * exactly the case the class docblock's "key" rule covers, so MySQL cannot take the TEXT spelling.
   */
  private static async addSessionTenantColumn(db: IDatabaseManager, keyType: string): Promise<void> {
    // Existing sessions are deleted: they carry no tenant claim, so they would be refused on the
    // next request anyway. Introducing tenancy logs everyone out, deliberately.
    await db.execute(sql.raw('DELETE FROM "_system_sessions"'));
    await ColumnGuard.addIfMissing(db, '_system_sessions', 'tenant_id', keyType);
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_sessions_tenant_idx" ON "_system_sessions" ("tenant_id")',
    ));
  }


}
