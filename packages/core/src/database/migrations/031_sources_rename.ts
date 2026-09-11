import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { Logger } from '../../logging';

/**
 * "Build server" becomes Sources, and its data comes with it.
 *
 * The screen was always Sources — it tracks repositories and asks the framework's extension builder
 * to build them. It was called `build-server` because it started life as a plugin, and that name
 * reached the slug, the table, the routes, the scheduler task, and three guard exemptions that exist
 * only because it was never really a plugin.
 *
 * A slug rename is not cosmetic: the slug is the key. Without this the extension would come up as a
 * NEW one with an empty table, while every tracked repository, its branch, its stored token and its
 * build history sat in a table nothing reads any more — present, intact and invisible. That is worse
 * than losing them, because nothing reports it.
 *
 * Every step is conditional and idempotent, so it is safe on a fresh installation, on one part-way
 * through, and on a re-run. It never writes over data already at the destination: if both tables
 * exist the old one is LEFT ALONE and reported, because which history is real is a decision for an
 * operator, and a migration quietly picking one is how the wrong answer becomes permanent.
 */
export class SourcesRenameMigration extends BaseMigration {
  readonly version = 31;
  readonly name = 'Rename the build-server extension to sources, carrying its data';

  private static readonly OLD_SLUG = 'build-server';
  private static readonly NEW_SLUG = 'sources';
  private static readonly OLD_TABLE = 'fcp_build_server_builds';
  private static readonly NEW_TABLE = 'fcp_sources_builds';
  private static readonly logger = new Logger({ namespace: 'SourcesRenameMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    await this.moveTable(db);
    await this.moveSlugKeyedRows(db);
  }

  /**
   * The builds table carries the operator's tracked repositories — the thing that must not be lost.
   *
   * A rename keeps the rows, the sequence, the indexes and the row-level-security policy attached to
   * the table; recreating it and copying rows would keep only the rows.
   */
  private async moveTable(db: IDatabaseManager): Promise<void> {
    if (!(await this.tableExists(db, SourcesRenameMigration.OLD_TABLE))) return;

    if (await this.tableExists(db, SourcesRenameMigration.NEW_TABLE)) {
      SourcesRenameMigration.logger.warn(
        `Both "${SourcesRenameMigration.OLD_TABLE}" and "${SourcesRenameMigration.NEW_TABLE}" exist. `
        + 'Leaving the old table untouched: which one holds the real build history is a decision for an '
        + 'operator. Nothing was lost — the old rows are still in the old table.',
      );
      return;
    }

    await db.execute(sql.raw(
      `ALTER TABLE ${SourcesRenameMigration.OLD_TABLE} RENAME TO ${SourcesRenameMigration.NEW_TABLE}`,
    ));
    SourcesRenameMigration.logger.info(
      `Renamed ${SourcesRenameMigration.OLD_TABLE} -> ${SourcesRenameMigration.NEW_TABLE}.`,
    );
  }

  /**
   * The slug is a FOREIGN KEY target, so it cannot simply be updated.
   *
   * `_system_plugin_settings.plugin_slug` and `_system_scheduler_tasks.plugin_slug` both reference
   * `_system_plugins.slug` with NO ACTION, which makes the rename impossible in either order: update
   * the parent and the children are orphaned; update the children first and they point at a row that
   * does not exist yet. The first attempt at this migration took the whole boot down with
   * "violates foreign key constraint _system_scheduler_tasks_plugin_slug_fkey".
   *
   * So the constraints are rebuilt with ON UPDATE CASCADE and the parent is then renamed once, taking
   * its children with it. That is not a workaround for this migration — a slug is an identifier the
   * framework owns and may rename, and NO ACTION made every such rename a foot-gun. The cascade stays.
   */
  private async moveSlugKeyedRows(db: IDatabaseManager): Promise<void> {
    const { OLD_SLUG, NEW_SLUG } = SourcesRenameMigration;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`
          DO $$
          DECLARE constraint_row record;
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM _system_plugins WHERE slug = '${OLD_SLUG}') THEN RETURN; END IF;
            IF EXISTS (SELECT 1 FROM _system_plugins WHERE slug = '${NEW_SLUG}') THEN RETURN; END IF;

            FOR constraint_row IN
              SELECT con.conname AS name,
                     con.conrelid::regclass::text AS child,
                     pg_get_constraintdef(con.oid) AS definition
                FROM pg_constraint con
                JOIN pg_class referenced ON referenced.oid = con.confrelid
               WHERE con.contype = 'f' AND referenced.relname = '_system_plugins'
                 AND pg_get_constraintdef(con.oid) NOT LIKE '%ON UPDATE CASCADE%'
            LOOP
              EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_row.child, constraint_row.name);
              EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON UPDATE CASCADE',
                             constraint_row.child, constraint_row.name, constraint_row.definition);
            END LOOP;

            UPDATE _system_plugins SET slug = '${NEW_SLUG}' WHERE slug = '${OLD_SLUG}';
          END $$;
        `));
      },
      sqlite: async () => {
        // No such constraints here; the columns are plain text.
        await this.executeIfTableExists(db, '_system_plugins',
          `UPDATE _system_plugins SET slug = '${NEW_SLUG}' WHERE slug = '${OLD_SLUG}' `
          + `AND NOT EXISTS (SELECT 1 FROM _system_plugins p WHERE p.slug = '${NEW_SLUG}')`);
        await this.executeIfTableExists(db, '_system_plugin_settings',
          `UPDATE _system_plugin_settings SET plugin_slug = '${NEW_SLUG}' WHERE plugin_slug = '${OLD_SLUG}'`);
        await this.executeIfTableExists(db, '_system_scheduler_tasks',
          `UPDATE _system_scheduler_tasks SET plugin_slug = '${NEW_SLUG}' WHERE plugin_slug = '${OLD_SLUG}'`);
      },
    });

    // The task NAME is `<slug>:<task>` and no foreign key covers it, so it is rewritten by prefix on
    // both dialects — the task part is the extension's own and must survive untouched.
    await this.executeIfTableExists(db, '_system_scheduler_tasks',
      `UPDATE _system_scheduler_tasks SET name = '${NEW_SLUG}' || SUBSTR(name, ${OLD_SLUG.length + 1}) `
      + `WHERE name LIKE '${OLD_SLUG}:%'`);
  }

  /**
   * Runs a statement only when its table is there.
   *
   * A deployment can legitimately lack any of these — a fresh database, or one whose scheduler has
   * never registered a task — and a migration that throws on an absent table blocks every boot after
   * it, for a rename that had nothing to do.
   */
  private async executeIfTableExists(db: IDatabaseManager, table: string, statement: string): Promise<void> {
    if (!(await this.tableExists(db, table))) return;
    await db.execute(sql.raw(statement));
  }

  /** Asking whether a table exists is the one thing with no portable spelling. */
  private async tableExists(db: IDatabaseManager, table: string): Promise<boolean> {
    let present = false;
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SourcesRenameMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM pg_class WHERE relname = '${table}'`)),
        );
      },
      sqlite: async () => {
        present = SourcesRenameMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = '${table}'`)),
        );
      },
    });
    return present;
  }

  /** Drivers answer either an array or `{ rows }`; both mean the same thing here. */
  private static hasRow(result: unknown): boolean {
    const list = (result as { rows?: unknown[] })?.rows ?? (result as unknown[]);
    return Array.isArray(list) ? list.length > 0 : Boolean(list);
  }
}
