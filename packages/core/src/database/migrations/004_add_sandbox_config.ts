import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';

class AddSandboxConfigMigration extends BaseMigration {
  readonly version = 4;
  readonly name = 'Add sandbox configuration to plugins table';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          ALTER TABLE "_system_plugins" 
          ADD COLUMN IF NOT EXISTS "sandbox_config" JSONB DEFAULT '{}'::jsonb
        `);
      },
      sqlite: async () => {
        try {
          await db.execute(sql`
            ALTER TABLE "_system_plugins" 
            ADD COLUMN "sandbox_config" TEXT DEFAULT '{}'
          `);
        } catch (e: any) {
          // SQLite lacks IF NOT EXISTS for ADD COLUMN — silently ignore if column already exists.
          // Drizzle wraps the error so check both e.message and e.cause.message.
          const msg: string = (e?.message ?? '') + (e?.cause?.message ?? '');
          if (!msg.includes('duplicate column name')) throw e;
        }
      }
    });
  }

  async down(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_plugins" DROP COLUMN IF EXISTS "sandbox_config"`);
      },
      sqlite: async () => {
        // SQLite doesn't support DROP COLUMN easily in older versions, 
        // but we'll try it anyway as it's a newer feature in 3.35+
        try {
          await db.execute(sql`ALTER TABLE "_system_plugins" DROP COLUMN "sandbox_config"`);
        } catch (e) {
          // SQLite 3.35+ feature: silently skip if column drop is unsupported
        }
      }
    });
  }
}

export default new AddSandboxConfigMigration();
