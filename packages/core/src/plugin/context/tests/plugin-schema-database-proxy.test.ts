import { describe, expect, it, vi } from 'vitest';
import { PluginSchemaDatabaseProxy } from '@core/plugin/context/plugin-schema-database-proxy';

describe('PluginSchemaDatabaseProxy', () => {
  const manager = (schemaDb: Record<string, unknown>, slugs: string[] = []) => ({
    schemaDb,
    db: {},
    audit: { logAction: vi.fn() },
    getPlugins: () => slugs.map((slug) => ({ manifest: { slug } })),
  }) as any;

  const plugin = (capabilities: string[]) => ({
    manifest: { slug: 'alpha', name: 'Alpha', version: '1.0.0', capabilities },
  }) as any;

  it('does not expose unknown owner-connection methods', () => {
    const resetDatabase = vi.fn();
    const ddl: any = PluginSchemaDatabaseProxy.create(
      plugin(['database:schema']),
      manager({ resetDatabase }),
    );

    expect(() => ddl.resetDatabase).toThrow(/cannot access schema database property/);
    expect(resetDatabase).not.toHaveBeenCalled();
  });

  it('requires an explicit schema capability', () => {
    const tableExists = vi.fn();
    const ddl: any = PluginSchemaDatabaseProxy.create(plugin(['database']), manager({ tableExists }));

    expect(() => ddl.tableExists).toThrow(/database:schema/);
    expect(tableExists).not.toHaveBeenCalled();
  });

  it('allows schema helpers for the plugin own table', async () => {
    const tableExists = vi.fn(async () => true);
    const ddl: any = PluginSchemaDatabaseProxy.create(
      plugin(['database:schema']),
      manager({ tableExists }),
    );

    await expect(ddl.tableExists('fcp_alpha_orders')).resolves.toBe(true);
    expect(tableExists).toHaveBeenCalledWith('fcp_alpha_orders');
  });

  it('requires cross-plugin approval for another plugin table', () => {
    const addColumn = vi.fn();
    const ddl: any = PluginSchemaDatabaseProxy.create(
      plugin(['database:schema']),
      manager({ addColumn }),
    );

    expect(() => ddl.addColumn('fcp_beta_orders', { name: 'note', type: 'text' }))
      .toThrow(/database:schema:cross-plugin/);
    expect(addColumn).not.toHaveBeenCalled();
  });

  it('offers the schema repairs plugins used raw SQL for, as named operations on their own tables', async () => {
    const helpers = {
      ensurePointInTimeColumn: vi.fn(async () => 'changed'),
      repairTextIdPrimaryKey: vi.fn(async () => undefined),
      ensureTimestampDefault: vi.fn(async () => 'changed'),
      dropColumnDefault: vi.fn(async () => 'changed'),
    };
    const ddl: any = PluginSchemaDatabaseProxy.create(plugin(['database:schema']), manager(helpers));

    await ddl.ensurePointInTimeColumn('fcp_alpha_orders', 'placed_at');
    await ddl.repairTextIdPrimaryKey('fcp_alpha_orders');
    await ddl.ensureTimestampDefault('fcp_alpha_orders', 'created_at');
    await ddl.dropColumnDefault('fcp_alpha_orders', 'currency');

    expect(helpers.ensurePointInTimeColumn).toHaveBeenCalledWith('fcp_alpha_orders', 'placed_at');
    expect(helpers.repairTextIdPrimaryKey).toHaveBeenCalledWith('fcp_alpha_orders');
    expect(helpers.ensureTimestampDefault).toHaveBeenCalledWith('fcp_alpha_orders', 'created_at');
    expect(helpers.dropColumnDefault).toHaveBeenCalledWith('fcp_alpha_orders', 'currency');
  });

  it('keeps those operations inside the plugin namespace — never a system or another plugin table', () => {
    const dropColumnDefault = vi.fn();
    const ddl: any = PluginSchemaDatabaseProxy.create(plugin(['database:schema']), manager({ dropColumnDefault }));

    expect(() => ddl.dropColumnDefault('_system_meta', 'value')).toThrow(/database:schema:cross-plugin/);
    expect(() => ddl.dropColumnDefault('fcp_beta_orders', 'currency')).toThrow(/database:schema:cross-plugin/);
    expect(dropColumnDefault).not.toHaveBeenCalled();
  });

  it('lets a data migration read and write its own rows with the capabilities its runtime already has', async () => {
    const find = vi.fn(async () => []);
    const update = vi.fn(async () => ({}));
    const reader: any = PluginSchemaDatabaseProxy.create(plugin(['database:read']), manager({ find, update }));
    const writer: any = PluginSchemaDatabaseProxy.create(plugin(['database:write']), manager({ find, update }));

    await reader.find('@alpha/orders', {});
    expect(() => reader.update).toThrow(/database:write/);
    await writer.update('fcp_alpha_orders', { id: 1 }, { note: 'x' });
    expect(() => writer.find('fcp_beta_orders', {})).toThrow(/database:schema:cross-plugin/);
    expect(() => writer.update('_system_meta', { id: 1 }, {})).toThrow(/database:schema:cross-plugin/);
    expect(find).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('offers the migration helpers as named operations inside the plugin namespace', async () => {
    const helpers = {
      createIndexIfMissing: vi.fn(), dropTableIfExists: vi.fn(), dropColumnIfExists: vi.fn(), copyColumnValues: vi.fn(),
    };
    const ddl: any = PluginSchemaDatabaseProxy.create(plugin(['database:schema']), manager(helpers));

    await ddl.createIndexIfMissing('fcp_alpha_orders', 'idx_alpha', ['placed_at']);
    await ddl.copyColumnValues('fcp_alpha_orders', 'sources', 'metadata', 'sources');
    await ddl.dropColumnIfExists('fcp_alpha_orders', 'metadata');
    expect(() => ddl.dropTableIfExists('users')).toThrow(/database:schema:cross-plugin/);
    expect(() => ddl.copyColumnValues('fcp_beta_orders', 'a', 'b')).toThrow(/database:schema:cross-plugin/);
    expect(helpers.dropTableIfExists).not.toHaveBeenCalled();
    expect(helpers.copyColumnValues).toHaveBeenCalledTimes(1);
  });

  it('never exposes raw SQL on the owner connection, not even to a plugin declaring database:raw', () => {
    const execute = vi.fn();
    const ddl: any = PluginSchemaDatabaseProxy.create(plugin(['database:schema', 'database:raw']), manager({ execute }));

    expect(() => ddl.execute).toThrow(/cannot access schema database property "execute"/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('gives a plugin with a hyphenated slug its own tables, in physical and semantic form', async () => {
    const tableExists = vi.fn(async () => true);
    const ddl: any = PluginSchemaDatabaseProxy.create(
      { manifest: { slug: 'two-words', name: 'Two', version: '1.0.0', capabilities: ['database:schema'] } } as any,
      manager({ tableExists }, ['two-words', 'alpha']),
    );

    await expect(ddl.tableExists('fcp_two_words_items')).resolves.toBe(true);
    await expect(ddl.tableExists('@two-words/items')).resolves.toBe(true);
    expect(() => ddl.tableExists('fcp_alpha_orders')).toThrow(/database:schema:cross-plugin/);
  });

  it('never hands a plugin the tables of a plugin whose slug extends its own', () => {
    const tableExists = vi.fn();
    const ddl: any = PluginSchemaDatabaseProxy.create(
      { manifest: { slug: 'shop', name: 'Shop', version: '1.0.0', capabilities: ['database:schema'] } } as any,
      manager({ tableExists }, ['shop', 'shop-extra']),
    );

    expect(() => ddl.tableExists('fcp_shop_extra_addresses')).toThrow(/database:schema:cross-plugin/);
    expect(() => ddl.tableExists('fcp_other_rows')).toThrow(/database:schema:cross-plugin/);
    expect(tableExists).not.toHaveBeenCalled();
  });
});
