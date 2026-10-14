import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';

/**
 * A plugin's settings and scheduled tasks follow it when it is renamed.
 *
 * Both reference `_system_plugins.slug` and are deleted with it, but a change of the slug was refused.
 * A renamed plugin (`replaces`, PluginSuccessionService) moves its registry row to the new slug, and
 * its settings are kept per site under row-level security, where no single connection can see them
 * all to rewrite them. `ON UPDATE CASCADE` lets the database carry every one along with the row.
 *
 * One `ALTER TABLE` per key, dropping and re-adding it in the same statement, so a key is never
 * missing for a moment and the deletion rule is kept as it was. Postgres only: the other drivers do not
 * enforce these keys, and the rename writes the rows itself there.
 */
export class PluginSlugFollowsRenamesMigration extends BaseMigration {
  readonly version = 64;
  readonly name = 'Plugin slug follows renames';
  /** Only how two existing keys react to an update the running release never makes. */
  readonly rollingSafe = true;

  private static readonly KEYS: Array<{ table: string; constraint: string }> = [
    { table: '_system_plugin_settings', constraint: '_system_plugin_settings_plugin_slug_fkey' },
    { table: '_system_scheduler_tasks', constraint: '_system_scheduler_tasks_plugin_slug_fkey' },
  ];

  async up(db: IDatabaseManager): Promise<void> {
    if (db.dialect !== 'postgres') return;
    for (const { table, constraint } of PluginSlugFollowsRenamesMigration.KEYS) {
      const present = await db.queryRaw(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [constraint]);
      if (!present.length) continue;
      await db.execute(Sql.raw(
        `ALTER TABLE ${table} DROP CONSTRAINT ${constraint}, `
        + `ADD CONSTRAINT ${constraint} FOREIGN KEY (plugin_slug) REFERENCES _system_plugins(slug) ON DELETE CASCADE ON UPDATE CASCADE`,
      ));
    }
  }
}
