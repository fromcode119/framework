import { describe, expect, it, vi } from 'vitest';
import { PluginMigrationRunner } from '@core/plugin/services/installation/plugin-migration-runner';
import { PluginSchemaDatabaseProxy } from '@core/plugin/context/plugin-schema-database-proxy';
import { PluginMigrationLoader } from '@core/database/plugin-migration-loader';
import { MigrationManager } from '@core/database/migration-manager';

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

/**
 * A first install creates the plugin's tables when it is enabled, AFTER its migrations: run then, a
 * backfill reading its pages failed the install with `relation "fcp_cms_pages" does not exist`.
 */
describe('PluginMigrationRunner on a first install', () => {
  const up = vi.fn(async () => undefined);
  const shipped = [{ name: 'plugin:cms:2026-05-26-backfill', version: 1, up }];
  const manager = (tables: string[]) => ({
    hasTablesWithPrefix: vi.fn(async (prefix: string) => tables.some((table) => table.startsWith(prefix))),
    recordApplied: vi.fn(async (migrations: unknown[]) => migrations.length),
    migrate: vi.fn(async () => undefined),
  });
  const run = async (m: ReturnType<typeof manager>, firstInstall: boolean) => {
    vi.spyOn(PluginMigrationLoader, 'load').mockResolvedValue(shipped as any);
    await new PluginMigrationRunner(m as any, () => ({}) as any).run('cms', '/plugins/cms', { slug: 'cms' } as any, undefined, firstInstall);
  };

  it('records the shipped migrations as applied without running them', async () => {
    const m = manager(['fcp_shop_orders', '_system_migrations']);
    await run(m, true);
    expect(m.recordApplied).toHaveBeenCalledWith(shipped);
    expect(m.migrate).not.toHaveBeenCalled();
    expect(up).not.toHaveBeenCalled();
  });

  it('runs them over tables that are already there (a reinstall that kept its data, an adopted predecessor)', async () => {
    const m = manager(['fcp_cms_pages']);
    await run(m, true);
    expect(m.recordApplied).not.toHaveBeenCalled();
    expect(m.migrate).toHaveBeenCalledTimes(1);
  });

  it('runs them on an update', async () => {
    const m = manager([]);
    await run(m, false);
    expect(m.hasTablesWithPrefix).not.toHaveBeenCalled();
    expect(m.migrate).toHaveBeenCalledTimes(1);
  });
});

describe('MigrationManager.recordApplied', () => {
  it('inserts only the unrecorded migrations, in one new batch', async () => {
    const db = {
      ensureMigrationTable: vi.fn(async () => undefined),
      find: vi.fn(async () => [{ name: 'plugin:cms:one' }]),
      execute: vi.fn(async () => [{ max_batch: 4 }]),
      insert: vi.fn(async () => undefined),
    };
    const recorded = await new MigrationManager(db as any).recordApplied([
      { name: 'plugin:cms:one', version: 1, up: vi.fn() },
      { name: 'plugin:cms:two', version: 2, up: vi.fn() },
    ]);
    expect(recorded).toBe(1);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledWith('_system_migrations', { name: 'plugin:cms:two', version: 2, batch: 5 });
  });
});
