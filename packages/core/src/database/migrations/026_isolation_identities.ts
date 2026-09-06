import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * T5c: every isolated plugin runs as its own OS user, and that user has to be the SAME one every
 * time the plugin starts — its data directory is owned by it. The number is assigned once, on the
 * plugin's first isolated start, and kept here. (The theme render hosts share one fixed identity and
 * need no row.)
 *
 * The two theme-render settings (`ssr_render_memory_mb`, `ssr_render_timeout_ms`) joined the platform
 * key list of the `_system_meta` policy at the same time; that list is applied by the boot sweep
 * (`TenantBespokePolicies`), so it needs no statement here.
 */
export class IsolationIdentitiesMigration extends BaseMigration {
  readonly version = 26;
  readonly name = 'Isolation identities: per-plugin OS uid';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_plugins" ADD COLUMN IF NOT EXISTS "isolation_uid" INTEGER`);
      },
      sqlite: async () => {
        try {
          await db.execute(sql`ALTER TABLE "_system_plugins" ADD COLUMN "isolation_uid" INTEGER`);
        } catch (e: any) {
          const msg: string = (e?.message ?? '') + (e?.cause?.message ?? '');
          if (!msg.includes('duplicate column name')) throw e;
        }
      },
    });
  }

  async down(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_plugins" DROP COLUMN IF EXISTS "isolation_uid"`);
      },
      sqlite: async () => {
        try {
          await db.execute(sql`ALTER TABLE "_system_plugins" DROP COLUMN "isolation_uid"`);
        } catch {
          // Older SQLite cannot drop a column; the column is harmless.
        }
      },
    });
  }
}
