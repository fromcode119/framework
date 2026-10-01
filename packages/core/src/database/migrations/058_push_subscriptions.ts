import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * A person's devices that accept a site's push messages.
 *
 * One row per browser subscription: the push service's endpoint and the browser's two keys, the person
 * it belongs to, and whether it was made on the storefront or the console. An endpoint is kept once
 * by the store (re-subscribing updates its row) rather than by a UNIQUE index, which a TEXT column
 * cannot carry on every dialect. The table carries no
 * `tenant_id` of its own on purpose — it is listed in `TenantScopedTables`, and the isolation sweep that
 * runs on every boot adds the column with the current-site default and applies the policy, so one site
 * can neither see nor message another site's devices.
 */
export class PushSubscriptionsMigration extends BaseMigration {
  readonly version = 58;
  readonly name = 'Push subscriptions';

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_push_subscriptions (
        id ${type.autoId},
        user_id INTEGER NOT NULL,
        surface ${type.key} NOT NULL,
        endpoint ${type.longTextNullable},
        p256dh ${type.shortText} NOT NULL,
        auth ${type.shortText} NOT NULL,
        label ${type.shortText},
        failures INTEGER NOT NULL DEFAULT 0,
        last_sent_at ${type.timestamp},
        created_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON _system_push_subscriptions (user_id, surface)'));
  }
}
