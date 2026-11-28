import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * Every email the platform sent, tried to send, or refused to send — one row per recipient.
 *
 * Mail left through one driver and nothing wrote down what it did: who was mailed, by which sender,
 * with what, and whether the server took it. A suppressed message went to the process log only.
 * Site-scoped as a journal (`TenantBespokePolicies`), which also adds `tenant_id`.
 */
export class EmailLogMigration extends BaseMigration {
  readonly version = 75;
  readonly name = 'Email log';
  /** Only a new table and its indexes: the running release never reads it. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_email_log (
        id ${type.autoId},
        sender ${type.shortText},
        template_key ${type.shortText},
        category ${type.shortText},
        to_address ${type.shortText} NOT NULL,
        subject TEXT,
        html TEXT,
        text TEXT,
        status ${type.key} NOT NULL,
        error TEXT,
        smtp_response TEXT,
        message_id ${type.shortText},
        scheduler_run_id INTEGER,
        content_removed_at ${type.timestamp},
        created_at ${type.timestamp} DEFAULT ${type.now},
        updated_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_email_log_created ON _system_email_log (created_at)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_email_log_address ON _system_email_log (to_address, created_at)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_email_log_message ON _system_email_log (message_id)'));
  }
}
