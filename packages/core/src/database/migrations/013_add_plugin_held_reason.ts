import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

export class AddPluginHeldReasonMigration extends BaseMigration {
  readonly version = 13;
  readonly name = 'Add held_reason to plugins table';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          ALTER TABLE "_system_plugins"
          ADD COLUMN IF NOT EXISTS "held_reason" TEXT
        `);
      },
      sqlite: async () => {
        try {
          await db.execute(sql`
            ALTER TABLE "_system_plugins"
            ADD COLUMN "held_reason" TEXT
          `);
        } catch (e: any) {
          const msg: string = (e?.message ?? '') + (e?.cause?.message ?? '');
          if (!msg.includes('duplicate column name')) throw e;
        }
      }
    });
  }

  async down(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_plugins" DROP COLUMN IF EXISTS "held_reason"`);
      },
      sqlite: async () => {
        try {
          await db.execute(sql`ALTER TABLE "_system_plugins" DROP COLUMN "held_reason"`);
        } catch (e) {
          // SQLite <3.35 lacks DROP COLUMN — silently skip.
        }
      }
    });
  }
}
