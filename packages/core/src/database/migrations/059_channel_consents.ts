import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * What each person agreed to be sent outside the site, and when.
 *
 * One row per person, channel (`sms`, `push`) and category (`updates`, `offers`): its existence IS the
 * consent, and `address` keeps the number it was given for — a text goes to the number someone agreed
 * with, never to whatever phone a profile holds now. `source` records where the agreement was made, so
 * it can be shown if anyone asks. Withdrawing deletes the row. Site-scoped through `TenantScopedTables`.
 */
export class ChannelConsentsMigration extends BaseMigration {
  readonly version = 59;
  readonly name = 'Channel consents';
  /** Only a new table and its index: the running release never reads it. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_channel_consents (
        id ${type.autoId},
        user_id INTEGER NOT NULL,
        channel ${type.key} NOT NULL,
        category ${type.key} NOT NULL,
        address ${type.shortText},
        source ${type.shortText},
        created_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_channel_consents_user ON _system_channel_consents (user_id, channel)'));
  }
}
