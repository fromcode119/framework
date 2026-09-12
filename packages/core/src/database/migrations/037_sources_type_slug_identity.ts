import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { Logger } from '../../logging';

/**
 * A build source is identified by its KIND and its slug, not by its slug alone.
 *
 * `tagiqx` the plugin, `tagiqx` the theme and `tagiqx` the appearance are three different
 * extensions. They clone into three different directories, stage into three different roots and
 * install through three different validators — the disk layout has always known this. Only the
 * table did not, so adding the second one failed with "a build source with slug tagiqx already
 * exists", and the operator was told to rename an extension to work around a missing index.
 *
 * Two shapes exist in the wild and this handles both. A table created by migration 032 declares
 * `slug TEXT NOT NULL UNIQUE`, so it carries a single-column unique (its generated name survived
 * 036's rename and is therefore still the OLD table's name — which is why the constraint is found
 * by its COLUMNS here, never by its name). A table that predates 032 has no unique at all; there,
 * the only thing that ever enforced uniqueness was a check in the service, and a slug-only
 * `update(table, { slug }, …)` would have written every row that shared the slug.
 *
 * A pre-existing duplicate pair is reported and the index is skipped, following 031 and 036: which
 * of two rows is the real one is an operator's decision, and a migration that throws here would
 * refuse to boot the whole platform over it. The service's own guard still refuses to create one,
 * so the gap cannot widen while it is open.
 */
export class SourcesTypeSlugIdentityMigration extends BaseMigration {
  readonly version = 37;
  readonly name = 'A build source is identified by (type, slug)';

  private static readonly TABLE = '_system_sources_builds';
  private static readonly INDEX = 'idx_system_sources_builds_type_slug';
  private static readonly logger = new Logger({ namespace: 'SourcesTypeSlugIdentityMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    if (!(await this.tableExists(db))) return;

    await this.dropSlugOnlyUniques(db);
    if (await this.hasDuplicatePairs(db)) return;
    await this.createCompositeIndex(db);
  }

  /**
   * Removes any unique whose column set is exactly `(slug)` — constraint or bare index.
   *
   * By catalogue lookup rather than by name: the same logical constraint is called different things
   * depending on which migration created the table and whether it has since been renamed, and a
   * `DROP CONSTRAINT IF EXISTS <guessed name>` that matches nothing fails silently and leaves the
   * old key in place, which is exactly the bug this migration exists to remove.
   */
  private async dropSlugOnlyUniques(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = SourcesTypeSlugIdentityMigration;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`
          DO $$
          DECLARE target record;
          BEGIN
            FOR target IN
              SELECT con.conname AS name
              FROM pg_constraint con
              JOIN pg_class rel ON rel.oid = con.conrelid
              WHERE rel.relname = '${TABLE}'
                AND con.contype = 'u'
                AND (SELECT array_agg(att.attname::text ORDER BY att.attname::text)
                     FROM unnest(con.conkey) AS k(attnum)
                     JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
                    ) = ARRAY['slug']::text[]
            LOOP
              EXECUTE format('ALTER TABLE ${TABLE} DROP CONSTRAINT %I', target.name);
            END LOOP;

            FOR target IN
              SELECT cls.relname AS name
              FROM pg_index idx
              JOIN pg_class cls ON cls.oid = idx.indexrelid
              JOIN pg_class rel ON rel.oid = idx.indrelid
              WHERE rel.relname = '${TABLE}'
                AND idx.indisunique
                AND NOT idx.indisprimary
                AND (SELECT array_agg(att.attname::text ORDER BY att.attname::text)
                     FROM unnest(idx.indkey) AS k(attnum)
                     JOIN pg_attribute att ON att.attrelid = idx.indrelid AND att.attnum = k.attnum
                    ) = ARRAY['slug']::text[]
            LOOP
              EXECUTE format('DROP INDEX %I', target.name);
            END LOOP;
          END $$;
        `));
      },
      sqlite: async () => {
        // An inline column UNIQUE cannot be dropped without rebuilding the table, and both dev and
        // production run Postgres. A SQLite deployment keeps the old key and the composite one
        // alongside it: the second kind is still refused there, and this says so rather than
        // rewriting a table to fix an environment nobody runs.
        logger.warn(
          'SQLite: a slug-only UNIQUE declared inline cannot be dropped without a table rebuild, '
          + 'so a second extension kind with the same slug stays refused on this dialect.',
        );
      },
    });
  }

  /** True when rows already share a `(type, slug)` pair, which the new index could not accept. */
  private async hasDuplicatePairs(db: IDatabaseManager): Promise<boolean> {
    const { TABLE, logger } = SourcesTypeSlugIdentityMigration;
    const result: any = await db.execute(sql.raw(
      `SELECT type, slug, COUNT(*) AS copies FROM ${TABLE} GROUP BY type, slug HAVING COUNT(*) > 1`,
    ));

    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    if (rows.length === 0) return false;

    const pairs = rows.map((row) => `${row.type}/${row.slug} (${row.copies})`).join(', ');
    logger.warn(
      `Not adding the unique (type, slug) index: these sources already share a pair — ${pairs}. `
      + 'Nothing was deleted; which row is the real one is an operator decision. Remove the extras '
      + 'in admin and restart, and the index will be created then.',
    );
    return true;
  }

  private async createCompositeIndex(db: IDatabaseManager): Promise<void> {
    const { TABLE, INDEX, logger } = SourcesTypeSlugIdentityMigration;
    await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX} ON ${TABLE} (type, slug)`));
    logger.info(`${TABLE} is keyed on (type, slug): one slug can name a plugin, a theme and an appearance.`);
  }

  private async tableExists(db: IDatabaseManager): Promise<boolean> {
    const { TABLE } = SourcesTypeSlugIdentityMigration;
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SourcesTypeSlugIdentityMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM pg_class WHERE relname = '${TABLE}'`)),
        );
      },
      sqlite: async () => {
        present = SourcesTypeSlugIdentityMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = '${TABLE}'`)),
        );
      },
    });

    return present;
  }

  private static hasRow(result: unknown): boolean {
    const rows: any[] = Array.isArray(result) ? result : ((result as any)?.rows ?? []);
    return rows.length > 0;
  }
}
