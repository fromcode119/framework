import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * `_system_tenants` — the tenant registry and host routing table.
 *
 * This is the table that RESOLVES tenancy, and therefore the one table that is never itself
 * tenant-scoped and carries no row-level-security policy: it must be readable before a tenant is
 * known. Everything else that holds tenant data gets `tenant_id` + a FORCEd RLS policy.
 *
 * `primary_host` is UNIQUE so two tenants cannot claim the same host. Host ambiguity is then a
 * data error caught at write time, never a routing guess at request time — serving one customer's
 * site on another's domain is exactly the failure this layer exists to prevent.
 */
export class SystemTenantsMigration extends BaseMigration {
  readonly version = 20;
  readonly name = 'Create _system_tenants (tenant registry and host routing)';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_tenants" (
            "id" TEXT PRIMARY KEY,
            "slug" TEXT NOT NULL UNIQUE,
            "primary_host" TEXT NOT NULL UNIQUE,
            "host_aliases" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "state" TEXT NOT NULL DEFAULT 'active',
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS "_system_tenants_state_idx" ON "_system_tenants" ("state")
        `);
      },
      sqlite: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_tenants" (
            "id" TEXT PRIMARY KEY,
            "slug" TEXT NOT NULL UNIQUE,
            "primary_host" TEXT NOT NULL UNIQUE,
            "host_aliases" TEXT NOT NULL DEFAULT '[]',
            "state" TEXT NOT NULL DEFAULT 'active',
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS "_system_tenants_state_idx" ON "_system_tenants" ("state")
        `);
      },
    });
  }
}
