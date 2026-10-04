import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginJsonRows } from '@core/plugin/host/plugin-json-rows';

/**
 * A `readOnRequest` field (a prepared card a read route answers with) made every other read of the
 * record carry it: a plugin's own list read each product's card, and the rows crossed into the plugin
 * process with it. A plugin's `find` / `findOne` now leaves such a field out unless it names its columns.
 */
const inSite = (name: string, fn: () => unknown) =>
  it(name, () => RequestContextUtils.storage.run({ locale: 'bg', tenantId: 't1' }, async () => { await fn(); }));

const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;
const row = () => ({ id: 1, title: 'Tee', public_card: { id: 1 }, card_keys: ['a'] });

function manager() {
  return {
    db: {
      find: vi.fn(async () => [row()]),
      findOne: vi.fn(async () => row()),
      findAsJson: vi.fn(async () => ({ text: '[{"id":1,"title":"Tee"}]', revive: {} })),
    },
    audit: { logAction: vi.fn() },
    getCollection: () => ({ collection: { fields: [{ name: 'title' }, { name: 'publicCard', readOnRequest: true }, { name: 'cardKeys', readOnRequest: true }] } }),
  } as any;
}

describe('context.db and readOnRequest fields', () => {
  beforeAll(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
  afterAll(() => TenantMode.reset());

  inSite('find and findOne leave them out of the rows they hand over', async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager(), security);
    expect(await db.find('fcp_alpha_items', { limit: 5 })).toEqual([{ id: 1, title: 'Tee' }]);
    expect(await db.findOne('fcp_alpha_items', { id: 1 })).toEqual({ id: 1, title: 'Tee' });
  });

  inSite('the JSON path does not select them', async () => {
    const m = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    await db.find('fcp_alpha_items', { limit: 5, [PluginJsonRows.REQUEST]: true });
    expect(m.db.findAsJson.mock.calls[0][1].omit).toEqual(['publicCard', 'cardKeys']);
  });

  inSite('a find that names its columns gets them', async () => {
    const m = manager();
    m.db.find.mockResolvedValueOnce([{ id: 1, public_card: { id: 1 } }]);
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    expect(await db.find('fcp_alpha_items', { columns: { id: true, publicCard: true } })).toEqual([{ id: 1, publicCard: { id: 1 } }]);
  });
});
