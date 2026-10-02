import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginJsonRows } from '@core/plugin/host/plugin-json-rows';

/**
 * A plugin PROCESS's `find` may be answered with the rows as JSON text (`findAsJson`). That answer
 * must come only after every guard a `find` passes — the table guard, the tenant predicate, the
 * archive filter — and `findAsJson` must never be reachable by plugin code itself.
 */
const inSite = (name: string, fn: () => unknown) =>
  it(name, () => RequestContextUtils.storage.run({ locale: 'bg', tenantId: 't1' }, async () => { await fn(); }));

const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

function manager(jsonAnswer: unknown = { text: '[{"id":1,"title":"{\\"bg\\":\\"къща\\",\\"en\\":\\"house\\"}"}]', revive: {} }) {
  return {
    db: {
      find: vi.fn(async () => [{ id: 1, page_title: 'Home', title: JSON.stringify({ bg: 'къща', en: 'house' }) }]),
      findAsJson: vi.fn(async () => jsonAnswer),
    },
    audit: { logAction: vi.fn() },
    getCollection: () => ({ collection: { fields: [{ name: 'title', localized: true }] } }),
  } as any;
}

const marked = (options: Record<string, unknown> = {}) => ({ ...options, [PluginJsonRows.REQUEST]: true });

describe('context.db.find answered as JSON rows', () => {
  beforeAll(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
  afterAll(() => TenantMode.reset());

  inSite('an ordinary find never takes the JSON path', async () => {
    const m = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    expect(await db.find('fcp_alpha_pages', { limit: 5 })).toEqual([{ id: 1, pageTitle: 'Home', title: 'къща' }]);
    expect(m.db.findAsJson).not.toHaveBeenCalled();
  });

  inSite('a marked find reaches findAsJson with the tenant predicate and without the mark', async () => {
    const m = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    const answer = await db.find('fcp_alpha_pages', marked({ where: { status: 'published' }, limit: 5 }));
    const [table, options] = m.db.findAsJson.mock.calls[0];
    expect(table).toBe('fcp_alpha_pages');
    expect(options.where).toMatchObject({ status: 'published', tenantId: 't1' });
    expect(Object.getOwnPropertySymbols(options)).toEqual([]);
    expect(m.db.find).not.toHaveBeenCalled();
    expect(PluginJsonRows.is(answer)).toBe(true);
    expect(PluginJsonRows.decode(answer)).toEqual([{ id: 1, title: 'къща' }]);
  });

  inSite('a marked find on another plugin\'s table is refused before anything runs', async () => {
    const m = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    await expect(async () => db.find('fcp_beta_orders', marked())).rejects.toThrow(/Security Violation/);
    expect(m.db.findAsJson).not.toHaveBeenCalled();
    expect(m.db.find).not.toHaveBeenCalled();
  });

  inSite('when the JSON path cannot answer, the same find runs and is post-processed as always', async () => {
    const m = manager(null);
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    expect(await db.find('fcp_alpha_pages', marked())).toEqual([{ id: 1, pageTitle: 'Home', title: 'къща' }]);
    expect(m.db.find).toHaveBeenCalledTimes(1);
  });

  inSite('the stored view keeps localized values as stored', async () => {
    const m = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    const rows = PluginJsonRows.decode(await db.stored.find('fcp_alpha_pages', marked())) as any[];
    expect(JSON.parse(rows[0].title)).toEqual({ bg: 'къща', en: 'house' });
  });

  inSite('plugin code cannot call findAsJson itself', async () => {
    const m = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    expect(() => db.findAsJson('fcp_alpha_pages', {})).toThrow(/Security Violation/);
    expect(m.db.findAsJson).not.toHaveBeenCalled();
  });
});
