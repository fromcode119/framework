import { describe, expect, it, vi } from 'vitest';
import { SchemaManager } from '@core/database/schema-manager';

/**
 * The review list is checked against what is registered NOW, not trusted from a boot-time snapshot.
 *
 * Measured on production after a rolling deploy: the seo plugin's own columns on pages, posts and
 * products (`meta_robots` holding a value on 141 of 141 pages) were proposed for removal, because the
 * boot-time audit ran before the plugin had registered what it adds to another plugin's table. Dropping
 * one from the review would have deleted live data.
 */
describe('SchemaManager review of undeclared columns', () => {
  const entry = (table: string, column: string) => ({ table, column, firstSeenAt: '2026-10-06T05:16:40.000Z' });

  const managerWith = (queue: Array<ReturnType<typeof entry>>, columns: string[]) => {
    const db: any = { tableExists: async () => true, getColumns: async () => columns, supportsTenantIsolation: () => true };
    const manager = new SchemaManager(db);
    const reconciliation = {
      pending: vi.fn(async () => queue),
      withCounts: vi.fn(async (entries: any[]) => entries.map((item) => ({ ...item, rows: 3, nonEmpty: 3 }))),
      forget: vi.fn(async () => undefined),
      approve: vi.fn(async (table: string, column: string) => entry(table, column)),
    };
    (manager as any).reconciliation = reconciliation;
    return { manager, reconciliation };
  };

  const pages = (fields: string[]) => ({ slug: 'fcp_cms_pages', fields: fields.map((name) => ({ name, type: 'text' })) }) as any;

  it('forgets a column a plugin declares by now, and counts only what is left', async () => {
    const { manager, reconciliation } = managerWith(
      [entry('fcp_cms_pages', 'meta_robots'), entry('fcp_cms_pages', 'old_flag')],
      ['id', 'title', 'meta_robots', 'old_flag'],
    );
    const listed = await manager.pendingDrops([pages(['title', 'metaRobots'])]);

    expect(listed.map((item) => item.column)).toEqual(['old_flag']);
    expect(reconciliation.forget).toHaveBeenCalledWith('fcp_cms_pages', 'meta_robots');
    expect(reconciliation.withCounts.mock.calls[0][0].map((item: any) => item.column)).toEqual(['old_flag']);
  });

  it('keeps an entry whose plugin is not running — nothing to compare with', async () => {
    const { manager, reconciliation } = managerWith([entry('fcp_licensing_keys', 'secret')], ['id', 'secret']);
    const listed = await manager.pendingDrops([pages(['title'])]);
    expect(listed.map((item) => item.column)).toEqual(['secret']);
    expect(reconciliation.forget).not.toHaveBeenCalled();
  });

  it('refuses to drop a column a plugin declares now, and forgets the stale proposal', async () => {
    const { manager, reconciliation } = managerWith([entry('fcp_cms_pages', 'meta_robots')], ['id', 'title', 'meta_robots']);
    await expect(manager.approveDrop('fcp_cms_pages', 'meta_robots', [pages(['title', 'metaRobots'])])).rejects.toThrow(/is not awaiting approval/);
    expect(reconciliation.approve).not.toHaveBeenCalled();
    expect(reconciliation.forget).toHaveBeenCalledWith('fcp_cms_pages', 'meta_robots');
  });

  it('still drops a column that is proposed and genuinely undeclared', async () => {
    const { manager, reconciliation } = managerWith([entry('fcp_cms_pages', 'old_flag')], ['id', 'title', 'old_flag']);
    const dropped = await manager.approveDrop('fcp_cms_pages', 'old_flag', [pages(['title'])]);
    expect(reconciliation.approve).toHaveBeenCalledWith('fcp_cms_pages', 'old_flag');
    expect(dropped.column).toBe('old_flag');
  });

  it('leaves a name nobody proposed to the service, which refuses it', async () => {
    const { manager, reconciliation } = managerWith([], ['id', 'title']);
    await manager.approveDrop('users', 'password', [pages(['title'])]);
    expect(reconciliation.approve).toHaveBeenCalledWith('users', 'password');
  });
});
