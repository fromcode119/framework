import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { ColumnGuard } from '@core/database/helpers/column-guard';

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
      mysql: async () => {
        // TEXT cannot carry a DEFAULT in MySQL, and both columns do — VARCHAR(191) is plenty for a
        // tenant kind or an appearance slug.
        await ColumnGuard.addIfMissing(db, '_system_tenants', 'kind', "VARCHAR(191) NOT NULL DEFAULT 'site'");
        await ColumnGuard.addIfMissing(db, '_system_tenants', 'appearance', "VARCHAR(191) NOT NULL DEFAULT ''");
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
      mysql: async () => {
        await db.execute(sql`ALTER TABLE "_system_tenants" DROP COLUMN "appearance"`);
        await db.execute(sql`ALTER TABLE "_system_tenants" DROP COLUMN "kind"`);
      },
    });
  }
}
