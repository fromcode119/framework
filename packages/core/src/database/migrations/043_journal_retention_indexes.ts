import { BaseMigration, IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { Logger } from '@core/logging';

/**
 * The columns the retention sweeps actually filter on.
 *
 * `JournalRetentionService` walks each journal with a repeated
 * `find({ where: { <ts>: { lt: cutoff } }, limit: 1000 })` until nothing older than the cutoff is
 * left. Without an index on that column every batch is a sequential scan of the whole table — and
 * the sweep is at its largest precisely when the table is (the first run after an operator sets a
 * window, clearing a backlog).
 *
 * Neither journal had one. `_system_audit_logs` indexes `plugin_slug`, `status` and `tenant_id`;
 * `_system_logs` indexes `plugin_slug` and `tenant_id`. Both are the columns you filter a VIEW by,
 * none is the column the sweep deletes by. The admin's Audit and Activity screens also order by
 * these columns, so the index earns its keep outside the sweep too.
 */
export class JournalRetentionIndexesMigration extends BaseMigration {
  readonly version = 43;
  readonly name = 'Index the journal columns retention sweeps filter on';

  private static readonly logger = new Logger({ namespace: 'JournalRetentionIndexesMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    // `createIndexIfMissing` is the house form and carries the dialect difference: MySQL has no
    // `CREATE INDEX IF NOT EXISTS`, and its manager translates the statement.
    await this.createIndexIfMissing(
      db,
      SystemConstants.TABLE.AUDIT_LOGS,
      'idx_system_audit_logs_created_at',
      ['created_at'],
    );
    await this.createIndexIfMissing(
      db,
      SystemConstants.TABLE.LOGS,
      'idx_system_logs_timestamp',
      ['timestamp'],
    );

    JournalRetentionIndexesMigration.logger.info(
      'Journal retention columns indexed. No rows are removed by this migration — retention stays off '
      + 'until an operator declares a window.',
    );
  }
}
