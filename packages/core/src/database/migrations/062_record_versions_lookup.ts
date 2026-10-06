import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * An index for finding a record's latest version.
 *
 * Every save of a record reads the newest version of THAT record to number the next one
 * (`WHERE ref_id = ? AND ref_collection = ? ORDER BY version DESC LIMIT 1`), and the table had no index
 * but its primary key. Each save therefore read the versions of every record of every collection: 7.5 ms
 * at 21,000 versions, and longer with every save anyone ever made. With the index it reads that
 * record's own few rows.
 */
export class RecordVersionsLookupMigration extends BaseMigration {
  readonly version = 62;
  readonly name = 'Record versions lookup index';
  /** An index the running release neither needs nor notices: it only makes a read it already does cheaper. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const table = SystemConstants.TABLE.RECORD_VERSIONS;
    // No columns at all means no table: nothing to index.
    if (!(await db.getColumns(table)).length) return;
    // MySQL cannot index a TEXT column whole; the other dialects can.
    const columns = db.dialect === 'mysql'
      ? '`ref_collection`(191), `ref_id`(191), `version`'
      : '"ref_collection", "ref_id", "version"';
    await db.execute(Sql.raw(`CREATE INDEX IF NOT EXISTS idx_record_versions_lookup ON ${table} (${columns})`));
  }
}
