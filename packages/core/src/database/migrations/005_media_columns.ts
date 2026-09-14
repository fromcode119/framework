import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { ColumnGuard } from '@core/database/helpers/column-guard';
import { DialectHelper } from '@core/database/helpers/dialect';

export class MediaColumnsBackfill extends BaseMigration {
  readonly version = 5;
  readonly name = 'Ensure media table has extended columns';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        // Add missing columns if they are not present
        await db.execute(sql`
          ALTER TABLE "media"
            ADD COLUMN IF NOT EXISTS "original_name" TEXT,
            ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
            ADD COLUMN IF NOT EXISTS "file_size" INTEGER,
            ADD COLUMN IF NOT EXISTS "width" INTEGER,
            ADD COLUMN IF NOT EXISTS "height" INTEGER,
            ADD COLUMN IF NOT EXISTS "alt" TEXT,
            ADD COLUMN IF NOT EXISTS "caption" TEXT,
            ADD COLUMN IF NOT EXISTS "folder_id" INTEGER,
            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        `);

        // Ensure folder_id FK exists if column is present
        await db.execute(sql`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'media' AND column_name = 'folder_id'
            ) THEN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                WHERE tc.table_name = 'media'
                  AND tc.constraint_type = 'FOREIGN KEY'
                  AND kcu.column_name = 'folder_id'
              ) THEN
                ALTER TABLE "media" ADD CONSTRAINT "media_folder_fk" FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL;
              END IF;
            END IF;
          END$$;
        `);
      },
      mysql: async () => {
        // MySQL has no IF NOT EXISTS on ADD COLUMN, so each is added individually — through
        // ColumnGuard, which probes first and speaks every dialect.
        //
        // This branch used to hand-roll that with two bugs, and the second hid the first: it built
        // `ADD COLUMN ${definition}` with NO column name, and it read its own existence check as
        // `const [row] = await db.execute(...)`, which on this driver took the rows ARRAY rather
        // than a row — so `row.count` was undefined, the guard never fired, and the broken ALTER
        // never ran. It only surfaced once `execute` started returning rows consistently.
        const columns: Array<[string, string]> = [
          ['original_name', 'TEXT'],
          ['mime_type', 'TEXT'],
          ['file_size', 'INT'],
          ['width', 'INT'],
          ['height', 'INT'],
          ['alt', 'TEXT'],
          ['caption', 'TEXT'],
          ['folder_id', 'INT'],
          ['updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'],
        ];
        for (const [name, definition] of columns) {
          await ColumnGuard.addIfMissing(db, 'media', name, definition);
        }

        // The foreign key is separate: a column can exist without it, and adding it twice is an error.
        const rows: any = await db.execute(sql`
          SELECT COUNT(*) AS count FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media'
            AND COLUMN_NAME = 'folder_id' AND REFERENCED_TABLE_NAME = 'media_folders'
        `);
        const existing = Array.isArray(rows) ? rows[0] : (rows?.rows ?? [])[0];
        if (Number(existing?.count ?? 0) === 0) {
          await db.execute(sql.raw(`ALTER TABLE media ADD CONSTRAINT media_folder_fk FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL`));
        }
      },
      sqlite: async () => {
        // SQLite requires individual ADD COLUMN statements — no IF NOT EXISTS.
        // Swallow duplicate-column errors so existing schemas pass cleanly.
        const addIfMissing = async (col: string, def: string) => {
          try {
            await db.execute(sql.raw(`ALTER TABLE "media" ADD COLUMN "${col}" ${def}`));
          } catch (e: any) {
            const msg = (e?.message ?? '') + (e?.cause?.message ?? '');
            if (!msg.includes('duplicate column name')) throw e;
          }
        };
        await addIfMissing('original_name', 'TEXT');
        await addIfMissing('mime_type', 'TEXT');
        await addIfMissing('file_size', 'INTEGER');
        await addIfMissing('width', 'INTEGER');
        await addIfMissing('height', 'INTEGER');
        await addIfMissing('alt', 'TEXT');
        await addIfMissing('caption', 'TEXT');
        await addIfMissing('folder_id', 'INTEGER');
        await addIfMissing('updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
      }
    });
  }
}
