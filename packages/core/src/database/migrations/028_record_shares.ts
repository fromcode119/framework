import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Lets a share point at plugin RECORDS, not only at media.
 *
 * The framework already owns everything a public share needs: a hashed per-recipient token, an expiry,
 * a download cap, revocation, and an access log (`_system_file_shares`, `_system_file_grants`,
 * `_system_file_access_log`). What it could not do was share anything other than files, so every plugin
 * that needed "send this record to someone by link" grew its own copy of the same machinery.
 *
 * Two columns fix that. `resource_type` names what is being shared, in the owning plugin's own terms,
 * and `resource_ids` lists which ones. A file share leaves both empty and behaves exactly as before.
 */
export class RecordSharesMigration extends BaseMigration {
  readonly version = 28;
  readonly name = 'Shares can point at plugin records, not only media';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_file_shares" ADD COLUMN IF NOT EXISTS "resource_type" TEXT NOT NULL DEFAULT ''`);
        await db.execute(sql`ALTER TABLE "_system_file_shares" ADD COLUMN IF NOT EXISTS "resource_ids" TEXT NOT NULL DEFAULT '[]'`);
      },
      sqlite: async () => {
        for (const statement of [
          sql`ALTER TABLE "_system_file_shares" ADD COLUMN "resource_type" TEXT NOT NULL DEFAULT ''`,
          sql`ALTER TABLE "_system_file_shares" ADD COLUMN "resource_ids" TEXT NOT NULL DEFAULT '[]'`,
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
        await db.execute(sql`ALTER TABLE "_system_file_shares" DROP COLUMN IF EXISTS "resource_ids"`);
        await db.execute(sql`ALTER TABLE "_system_file_shares" DROP COLUMN IF EXISTS "resource_type"`);
      },
      sqlite: async () => {
        // Older SQLite cannot drop a column; the columns are harmless.
      },
    });
  }
}
