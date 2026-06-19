import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';

/**
 * Additive: add a `metadata` JSON column to `people_addresses`. The shared address book exposes a
 * fixed set of columns (label, full_name, address_line1/2, city, postal_code, country, phone,
 * is_default); plugin-specific delivery binding (e.g. Econt city/office, delivery provider) is stashed
 * here as a JSON blob so the shared table never grows a per-plugin column. Idempotent — runs once and
 * tolerates the column already existing.
 */
class PeopleAddressMetadataMigration extends BaseMigration {
  readonly version = 10;
  readonly name = 'Add metadata JSON column to people_addresses';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          ALTER TABLE "people_addresses"
            ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb
        `);
      },
      mysql: async () => {
        const [row]: any = await db.execute(sql`
          SELECT COUNT(*) AS count
          FROM information_schema.columns
          WHERE table_name = 'people_addresses' AND column_name = 'metadata'
        `);
        if (Number(row?.count) === 0) {
          await db.execute(sql.raw(`ALTER TABLE people_addresses ADD COLUMN metadata JSON`));
        }
      },
      sqlite: async () => {
        try {
          await db.execute(sql.raw(`ALTER TABLE "people_addresses" ADD COLUMN "metadata" TEXT DEFAULT '{}'`));
        } catch (e: any) {
          const msg = (e?.message ?? '') + (e?.cause?.message ?? '');
          if (!msg.includes('duplicate column name')) throw e;
        }
      }
    });
  }
}

export default new PeopleAddressMetadataMigration();
