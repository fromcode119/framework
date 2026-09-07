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
