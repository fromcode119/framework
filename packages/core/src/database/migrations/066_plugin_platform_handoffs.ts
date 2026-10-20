import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * `_system_plugin_platform_handoffs` — every `context.platform` ticket that has been used, and the claim
 * it carries while the console that asked finishes it (`PluginPlatformHandoffs`).
 *
 * One row per ticket nonce (the primary key), so a ticket is used once. The platform part no longer
 * grants keys itself: it parks them here with a one-time handoff (`handoff_hash`, the sha256 of the
 * value the browser carries back) and the asking console's signed-in operator completes the claim.
 * `payload` is sealed with the installation's key — it can hold a provider's access token.
 *
 * `_system_*`, so unscoped (`TenantScopedTables`): only framework code reads it, on the raw connection.
 */
export class PluginPlatformHandoffsMigration extends BaseMigration {
  readonly version = 66;
  readonly name = 'Plugin platform handoffs';
  /** A new table: the running release never reads it. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_plugin_platform_handoffs (
        nonce ${type.key} PRIMARY KEY,
        plugin_slug ${type.key} NOT NULL,
        tenant_id ${type.shortText},
        user_id ${type.shortText} NOT NULL,
        state ${type.shortText} NOT NULL,
        claim_keys ${type.json},
        payload TEXT,
        return_to TEXT,
        handoff_hash ${type.shortText},
        handoff_expires_at ${type.timestamp},
        expires_at ${type.timestamp},
        completed_at ${type.timestamp},
        created_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_platform_handoffs_hash ON _system_plugin_platform_handoffs (handoff_hash)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_plugin_platform_handoffs_slug ON _system_plugin_platform_handoffs (plugin_slug)'));
  }
}
