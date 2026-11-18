import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * Every announced event that a plugin listener FAILED to handle, so a swallowed failure becomes a row
 * an operator can see and retry instead of a line in the process log nobody reads.
 *
 * `context.hooks.emit` is fire-and-forget: a listener that throws was caught and `console.error`-d, so
 * a paid order whose licence-key listener failed left the customer without a key and no trace on the
 * console. One row per (event, plugin, site) that is currently failing: repeated failures of the same
 * listener raise `attempts` rather than adding rows, and the row flips to `resolved` the next time that
 * listener handles the event (a retry, or the next live emit). The payload is kept so a retry can re-run
 * the listener with exactly what it was given.
 */
export class EventDeliveriesMigration extends BaseMigration {
  readonly version = 70;
  readonly name = 'Event deliveries';
  /** Only a new table and its indexes: the running release never reads it. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_event_deliveries (
        id ${type.autoId},
        event ${type.shortText} NOT NULL,
        plugin_slug ${type.shortText} NOT NULL,
        tenant_id INTEGER,
        status ${type.key} NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        payload ${type.json},
        error TEXT,
        dedupe_key ${type.shortText},
        created_at ${type.timestamp} DEFAULT ${type.now},
        updated_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_event_deliveries_open ON _system_event_deliveries (status, updated_at)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_event_deliveries_listener ON _system_event_deliveries (plugin_slug, event)'));
  }
}
