import { describe, expect, it, vi } from 'vitest';
import { PluginSchemaDatabaseProxy } from '@core/plugin/context/plugin-schema-database-proxy';

describe('PluginSchemaDatabaseProxy', () => {
  const manager = (schemaDb: Record<string, unknown>) => ({
    schemaDb,
    db: {},
    audit: { logAction: vi.fn() },
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

  it('requires raw approval before arbitrary SQL execution', () => {
    const execute = vi.fn();
    const ddl: any = PluginSchemaDatabaseProxy.create(
      plugin(['database:schema']),
      manager({ execute }),
    );

    expect(() => ddl.execute).toThrow(/database:raw/);
    expect(execute).not.toHaveBeenCalled();
  });
});
