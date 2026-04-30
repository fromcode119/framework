import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';

class MediaWebPColumnsBackfill extends BaseMigration {
  readonly version = 8;
  readonly name = 'Add WebP optimization columns to media table';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          ALTER TABLE "media"
            ADD COLUMN IF NOT EXISTS "optimized_path" TEXT,
            ADD COLUMN IF NOT EXISTS "optimized_size" INTEGER,
            ADD COLUMN IF NOT EXISTS "optimized_width" INTEGER,
            ADD COLUMN IF NOT EXISTS "optimized_height" INTEGER;
        `);
      },
      mysql: async () => {
        const addColumnIfMissing = async (name: string, definition: string) => {
          const [row]: any = await db.execute(sql`
            SELECT COUNT(*) AS count
            FROM information_schema.columns
            WHERE table_name = 'media' AND column_name = ${name}
          `);
          if (Number(row.count) === 0) {
            await db.execute(sql.raw(`ALTER TABLE media ADD COLUMN ${definition}`));
          }
        };

        await addColumnIfMissing('optimized_path', 'TEXT');
        await addColumnIfMissing('optimized_size', 'INT');
        await addColumnIfMissing('optimized_width', 'INT');
        await addColumnIfMissing('optimized_height', 'INT');
      },
      sqlite: async () => {
        const addIfMissing = async (col: string, def: string) => {
          try {
            await db.execute(sql.raw(`ALTER TABLE "media" ADD COLUMN "${col}" ${def}`));
          } catch (e: any) {
            const msg = (e?.message ?? '') + (e?.cause?.message ?? '');
            if (!msg.includes('duplicate column name')) throw e;
          }
        };
        await addIfMissing('optimized_path', 'TEXT');
        await addIfMissing('optimized_size', 'INTEGER');
        await addIfMissing('optimized_width', 'INTEGER');
        await addIfMissing('optimized_height', 'INTEGER');
      }
    });
  }
}

export default new MediaWebPColumnsBackfill();
