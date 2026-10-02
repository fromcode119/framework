import { describe, expect, it, vi } from 'vitest';
import { TableResolver } from '@fromcode119/database';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * A plugin may read and write only its OWN tables through `context.db`. Another plugin's table must be
 * refused however it is named — physically (`fcp_beta_orders`) or as the `@plugin/entity` alias the
 * database layer resolves to that same table. The guard used to check the name BEFORE resolution,
 * so `@beta/orders` passed it and reached `fcp_beta_orders`.
 */
const inSite = (name: string, fn: () => unknown) =>
  it(name, () => RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, async () => { await fn(); }));

const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

function manager() {
  // The real manager resolves `@plugin/entity` the way the factory proxy does.
  const reached: string[] = [];
  const db = {
    find: vi.fn(async (table: string) => { reached.push(TableResolver.resolve(table)); return []; }),
    insert: vi.fn(async (table: string) => { reached.push(TableResolver.resolve(table)); return {}; }),
  };
  return { reached, manager: { db, audit: { logAction: vi.fn() }, getCollection: () => null } as any };
}

describe('context.db refuses another plugin\'s table under any name', () => {
  inSite('a physical name of another plugin\'s table is refused (as before)', async () => {
    const { manager: m, reached } = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    await expect(async () => db.find('fcp_beta_orders')).rejects.toThrow(/Security Violation/);
    expect(reached).toEqual([]);
  });

  inSite('the @plugin/entity alias of another plugin\'s table is refused too', async () => {
    const { manager: m, reached } = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    await expect(async () => db.find('@beta/orders')).rejects.toThrow(/Security Violation/);
    await expect(async () => db.insert('@beta/orders', { id: 1 })).rejects.toThrow(/Security Violation/);
    expect(reached).toEqual([]);
  });

  inSite('the plugin\'s own tables stay reachable by alias and by physical name', async () => {
    const { manager: m, reached } = manager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    await db.find('@alpha/pages');
    await db.find('fcp_alpha_pages');
    expect(reached).toEqual(['fcp_alpha_pages', 'fcp_alpha_pages']);
  });
});
