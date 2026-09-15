import { describe, expect, it, vi } from 'vitest';
import { SchemaManager } from '@core/database/schema-manager';

/**
 * WHICH TABLES MAY BE JUDGED AT ALL.
 *
 * A framework table's columns come from MIGRATIONS, so its collection field list was never the full
 * declaration and a diff against it is meaningless. Two live columns proved it by being proposed for
 * removal: `media.shared`, which the media sharing POLICY itself reads, and `users.is_platform_admin`,
 * which decides who is a platform administrator.
 */
describe('SchemaManager.recordUndeclaredColumns — what may be audited', () => {
  const dbStub = () => ({
    tableExists: async () => true,
    getColumns: async () => ['id', 'shared', 'optimized_path'],
    supportsTenantIsolation: () => true,
  } as any);

  it('never audits a framework collection, however many columns it has', async () => {
    const manager = new SchemaManager(dbStub());
    const recorded: string[] = [];
    (manager as any).reconciliation = {
      record: async (plan: any) => { recorded.push(plan.tableName); },
      prune: async () => undefined,
    };

    await manager.recordUndeclaredColumns([
      { collection: { slug: 'media', fields: [] } as any, pluginSlug: 'system' },
      { collection: { slug: 'record-versions', fields: [], system: true } as any, pluginSlug: 'cms' },
    ]);

    expect(recorded).toEqual([]);
  });

  it('protects only a FAILED audit from pruning, so nothing can be stranded', async () => {
    const manager = new SchemaManager(dbStub());
    let failedTables = new Set<string>();
    (manager as any).reconciliation = {
      record: async () => undefined,
      prune: async (failed: Set<string>) => { failedTables = failed; },
    };

    await manager.recordUndeclaredColumns([
      { collection: { slug: 'media', fields: [] } as any, pluginSlug: 'system' },
    ]);

    // A framework collection is excluded from judgement and NOT protected, so anything a past build
    // recorded against it is cleaned up rather than left where it can be approved.
    expect(failedTables.has('media')).toBe(false);
  });
});
