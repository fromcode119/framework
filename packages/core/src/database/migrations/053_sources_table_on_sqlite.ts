import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '@core/logging';

/**
 * Finishes, on SQLite, the Sources table move every other dialect already made.
 *
 * The step that renamed `fcp_sources_builds` to `_system_sources_builds` decided whether a table
 * existed by reading rows out of `execute`, and the SQLite driver's `execute` returns no rows for a
 * SELECT. So on SQLite the table was never renamed, the (type, slug) identity was never added, and the
 * Sources screen — which reads `_system_sources_builds` — found no table at all.
 *
 * Only what is missing is done, so this is a no-op on PostgreSQL and MySQL, which were never affected,
 * and on a fresh install, which creates the table correctly. The old slug-only UNIQUE stays on an
 * affected SQLite table: it is declared inline, and dropping it means rebuilding the table.
 */
export class SourcesTableOnSqliteMigration extends BaseMigration {
  readonly version = 53;
  readonly name = 'Finish moving the Sources table on SQLite';

  private static readonly OLD_TABLE = 'fcp_sources_builds';
  private static readonly NEW_TABLE = '_system_sources_builds';
  private static readonly logger = new Logger({ namespace: 'SourcesTableOnSqliteMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { OLD_TABLE, NEW_TABLE, logger } = SourcesTableOnSqliteMigration;
    if (await db.tableExists(OLD_TABLE)) {
      if (await db.tableExists(NEW_TABLE)) {
        logger.warn(`Both "${OLD_TABLE}" and "${NEW_TABLE}" exist; which holds the real sources is an operator's call. Nothing was moved.`);
        return;
      }
      await db.execute(sql.raw(`ALTER TABLE ${OLD_TABLE} RENAME TO ${NEW_TABLE}`));
      logger.info(`Renamed ${OLD_TABLE} -> ${NEW_TABLE}.`);
    }
    if (!(await db.tableExists(NEW_TABLE))) return;
    await this.createIndexIfMissing(db, NEW_TABLE, 'idx_system_sources_builds_type_slug', ['type', 'slug'], { unique: true });
  }
}
