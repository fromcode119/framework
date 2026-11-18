import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * The keys of effects that have already run, so the same logical event handled twice does its work once.
 *
 * A listener wraps a side effect in `EventIdempotency.once(scope, key, fn)` — `scope` is usually the
 * (event, plugin) pair, `key` the thing it is about (an order number, a payment id). The first call runs
 * the effect and keeps the key; a second call with the same key is skipped. The UNIQUE index is the real
 * guard — two arrivals at once resolve to one insert, the other is told it is a duplicate — so this is
 * what makes a retry, or a provider that sends its callback twice, not issue two keys or record two
 * payments. `tenant_id` is the site's own id as a string (the empty string for a platform-scoped key),
 * so two sites never share a bucket and uniqueness holds across every dialect — a NUMBER column would
 * fold every non-numeric tenant into one bucket and leak dedupe across sites.
 */
export class EventDedupeMigration extends BaseMigration {
  readonly version = 71;
  readonly name = 'Event idempotency keys';
  /** Only a new table and its unique index: the running release never reads it. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_event_dedupe (
        id ${type.autoId},
        scope ${type.shortText} NOT NULL,
        dedupe_key ${type.shortText} NOT NULL,
        tenant_id ${type.key} NOT NULL DEFAULT '',
        created_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_event_dedupe_unique ON _system_event_dedupe (scope, dedupe_key, tenant_id)'));
  }
}
