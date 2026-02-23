import { SystemMigration } from '../../types';
import { executeForDialect } from '../helpers/dialect';

export const MediaColumnsBackfill: SystemMigration = {
  version: 5,
  name: 'Ensure media table has extended columns',
  up: async (db, sql) => {
    await executeForDialect(db.dialect, {
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
        // MySQL lacks IF NOT EXISTS on multiple add; add individually
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

        await addColumnIfMissing('original_name', 'TEXT');
        await addColumnIfMissing('mime_type', 'TEXT');
        await addColumnIfMissing('file_size', 'INT');
        await addColumnIfMissing('width', 'INT');
        await addColumnIfMissing('height', 'INT');
        await addColumnIfMissing('alt', 'TEXT');
        await addColumnIfMissing('caption', 'TEXT');
        await addColumnIfMissing('folder_id', 'INT');
        await addColumnIfMissing('updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');

        // FK for folder_id
        const [fkRow]: any = await db.execute(sql`
          SELECT COUNT(*) AS count FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_NAME = 'media' AND COLUMN_NAME = 'folder_id' AND REFERENCED_TABLE_NAME = 'media_folders'
        `);
        if (Number(fkRow.count) === 0) {
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
};

export default MediaColumnsBackfill;