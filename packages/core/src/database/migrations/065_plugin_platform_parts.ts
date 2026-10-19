import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * What a plugin's PLATFORM part keeps (`context.platform`).
 *
 * `_system_plugin_platform_settings` — one row per plugin: the settings of the part that answers for
 * every site at once (a provider app's id and secret). `_system_plugin_settings` cannot hold them: a
 * plugin's configuration there is always a site's, and a platform write with no site bound is skipped.
 *
 * `_system_plugin_claims` — which site or workspace owns an external key (a provider account id) the
 * platform part receives traffic for. Unique per plugin, so one account belongs to one owner and a
 * second claim is refused. `tenant_id` is null on an installation with no tenants.
 *
 * Both are `_system_*` and therefore unscoped (`TenantScopedTables`): only framework code reads them,
 * on the raw connection, never a plugin and never a tenant's request.
 */
export class PluginPlatformPartsMigration extends BaseMigration {
  readonly version = 65;
  readonly name = 'Plugin platform parts';
  /** Two new tables: the running release never reads them. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_plugin_platform_settings (
        plugin_slug ${type.key} PRIMARY KEY,
        settings ${type.json} NOT NULL,
        updated_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_plugin_claims (
        id ${type.autoId},
        plugin_slug ${type.key} NOT NULL,
        claim_key ${type.shortText} NOT NULL,
        tenant_id ${type.shortText},
        created_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_claims_key ON _system_plugin_claims (plugin_slug, claim_key)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_plugin_claims_tenant ON _system_plugin_claims (plugin_slug, tenant_id)'));
  }
}
