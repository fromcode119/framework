import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * T6: what a tenant IS. `kind` — `site` (a storefront on its domain, admin on the shared admin host)
 * or `workspace` (its domain serves the admin, locked to `appearance`). Every existing tenant is a
 * site: that is exactly what they have been. The defaults here ARE the declared defaults the create
 * form shows; code never invents another.
 */
export class TenantKindsMigration extends BaseMigration {
  readonly version = 27;
  readonly name = 'Tenant kinds: site or workspace, with the workspace appearance';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_tenants" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'site'`);
        await db.execute(sql`ALTER TABLE "_system_tenants" ADD COLUMN IF NOT EXISTS "appearance" TEXT NOT NULL DEFAULT ''`);
      },
      sqlite: async () => {
        for (const statement of [
          sql`ALTER TABLE "_system_tenants" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'site'`,
          sql`ALTER TABLE "_system_tenants" ADD COLUMN "appearance" TEXT NOT NULL DEFAULT ''`,
        ]) {
          try {
            await db.execute(statement);
          } catch (e: any) {
            const msg: string = (e?.message ?? '') + (e?.cause?.message ?? '');
            if (!msg.includes('duplicate column name')) throw e;
          }
        }
      },
    });
  }

  async down(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_tenants" DROP COLUMN IF EXISTS "appearance"`);
        await db.execute(sql`ALTER TABLE "_system_tenants" DROP COLUMN IF EXISTS "kind"`);
      },
      sqlite: async () => {
        // Older SQLite cannot drop a column; the columns are harmless.
      },
    });
  }
}
