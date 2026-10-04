import { describe, expect, it, vi } from 'vitest';
import { PluginMigrationRunner } from '@core/plugin/services/installation/plugin-migration-runner';
import { PluginSchemaDatabaseProxy } from '@core/plugin/context/plugin-schema-database-proxy';

/**
 * A plugin's migrations must never receive the schema-OWNER connection the runner holds: on it a plugin
 * could read any table or switch row-level security off. They get the plugin's own proxy instead.
 */
describe('PluginMigrationRunner', () => {
  it('hands each migration the plugin database, whatever the runner passes', async () => {
    const owner = { name: 'owner' } as any;
    const pluginDb = { name: 'plugin' } as any;
    const up = vi.fn(async () => undefined);
    const down = vi.fn(async () => undefined);
    const [bound] = PluginMigrationRunner.bind([{ name: 'plugin:alpha:one', version: 1, up, down }], pluginDb);

    const tenants = { forEachTenant: vi.fn() } as any;
    await bound.up(owner, 'sql', tenants);
    await bound.down!(owner, 'sql');

    expect(up).toHaveBeenCalledWith(pluginDb, 'sql', tenants);
    expect(down).toHaveBeenCalledWith(pluginDb, 'sql');
  });

  it('keeps a migration with no down without one', () => {
    const [bound] = PluginMigrationRunner.bind([{ name: 'plugin:alpha:one', version: 1, up: vi.fn() }], {} as any);
    expect(bound.down).toBeUndefined();
  });

  it('confines a real plugin migration to its own tables and capabilities', async () => {
    const owner = { getColumns: vi.fn(async () => []), addColumn: vi.fn(), find: vi.fn(async () => []), execute: vi.fn() };
    const manager = { schemaDb: owner, db: {}, audit: { logAction: vi.fn() }, getPlugins: () => [] } as any;
    const plugin = { manifest: { slug: 'alpha', name: 'Alpha', version: '1.0.0', capabilities: ['database:write', 'database:schema'] } } as any;
    const db = PluginSchemaDatabaseProxy.create(plugin, manager) as any;

    const migration = {
      name: 'plugin:alpha:reach',
      version: 1,
      up: async (d: any) => {
        await d.find('fcp_alpha_orders', {});
        await d.find('users', {});
      },
    };
    const [bound] = PluginMigrationRunner.bind([migration], db);

    await expect(bound.up(owner as any, null, {} as any)).rejects.toThrow(/cannot use schema\.find on "users"/);
    expect(owner.find).toHaveBeenCalledTimes(1);
    expect(owner.find).toHaveBeenCalledWith('fcp_alpha_orders', {});
    expect(() => db.execute).toThrow(/cannot access schema database property "execute"/);
  });
});
