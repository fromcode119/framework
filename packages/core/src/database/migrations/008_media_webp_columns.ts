import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { ColumnGuard } from '@core/database/helpers/column-guard';
import { DialectHelper } from '@core/database/helpers/dialect';

export class MediaWebPColumnsBackfill extends BaseMigration {
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
        // Through ColumnGuard, which probes and speaks every dialect. The hand-rolled version here
        // built `ADD COLUMN ${definition}` with no column NAME, and never ran because its own
        // existence check misread the result shape — see the note in 005, which had the same pair.
        for (const [name, definition] of [
          ['optimized_path', 'TEXT'],
          ['optimized_size', 'INT'],
          ['optimized_width', 'INT'],
          ['optimized_height', 'INT'],
        ] as Array<[string, string]>) {
          await ColumnGuard.addIfMissing(db, 'media', name, definition);
        }
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
