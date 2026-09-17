import { SqlIdentifier } from '@database/dialects/postgres/sql-identifier';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';

/**
 * Re-keys a table whose `id` was created as TEXT back to an integer primary key.
 *
 * The schema builder once emitted a TEXT `id` for a table that declared none, so early installs
 * carry a primary key nothing increments. Re-keying assigns fresh values, so a caller must check for
 * rows that stored one of the old ids elsewhere: a foreign key blocks the ALTER, but an id copied
 * into a JSON blob or another plugin's column is silently orphaned.
 *
 * WHY IT LIVES HERE. This was two `DO $$` blocks inside `BaseMigration`, the dialect-NEUTRAL base
 * class every migration extends, guarded by `if (db.dialect !== 'postgres') return`. That is the
 * exact pair of symptoms the confinement rule exists to catch: Postgres-only SQL outside the driver
 * that owns it, and a caller comparing a dialect name by string because the abstraction did not
 * carry the operation. The operation is now the driver's, and a driver that cannot do it says so by
 * inheriting the no-op — SQLite genuinely cannot ALTER a column type in place.
 *
 * BOTH STATEMENTS ARE IDEMPOTENT, and they are two rather than one on purpose: a table may already
 * have an integer `id` and still be missing its PRIMARY KEY, which the second block adds on its own.
 */
export class PostgresTextIdPrimaryKeyRepair {
  constructor(private readonly run: ISqlRunner) {}

  /**
   * Repair one table. The identifiers are asserted HERE, where they are interpolated — a `DO $$`
   * body cannot take parameters, so the only defence is refusing anything that is not a plain
   * identifier before it reaches the string.
   */
  async repair(tableName: string): Promise<void> {
    const table = SqlIdentifier.assert(tableName, 'PostgresTextIdPrimaryKeyRepair');
    const sequence = SqlIdentifier.assert(`${table}_id_seq`, 'PostgresTextIdPrimaryKeyRepair');

    await this.run(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = '${table}'
            AND column_name = 'id'
            AND data_type IN ('text', 'character varying', 'character')
        ) THEN
          CREATE SEQUENCE IF NOT EXISTS "${sequence}";
          ALTER TABLE "${table}" ALTER COLUMN "id" DROP DEFAULT;
          ALTER TABLE "${table}" ALTER COLUMN "id" TYPE integer USING nextval('"${sequence}"');
          ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT nextval('"${sequence}"');
          ALTER TABLE "${table}" ALTER COLUMN "id" SET NOT NULL;
          ALTER SEQUENCE "${sequence}" OWNED BY "${table}"."id";
          PERFORM setval('"${sequence}"', COALESCE((SELECT MAX("id") FROM "${table}"), 0) + 1, false);
        END IF;
      END
      $$;
    `);

    await this.run(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = '"${table}"'::regclass AND contype = 'p'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = '${table}'
            AND column_name = 'id'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE "${table}" ADD PRIMARY KEY ("id");
        END IF;
      END
      $$;
    `);
  }
}
