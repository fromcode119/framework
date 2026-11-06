import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteContentRevision } from '@core/tenant/site-content-revision';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * A 404 log row written on every missed URL moved the site's revision, so every bot probe threw away
 * every page and answer kept for the site. A collection that declares `affectsPages: false` holds rows
 * no page is built from: writing them leaves the revision alone. Any other collection still moves it.
 */
const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

function manager(affectsPages: boolean | undefined) {
  return {
    db: { insert: vi.fn(async () => ({ id: 1 })), update: vi.fn(async () => ({ id: 1 })), upsert: vi.fn(async () => ({ id: 1 })), delete: vi.fn(async () => true) },
    audit: { logAction: vi.fn() },
    getCollection: () => ({ collection: { affectsPages, fields: [{ name: 'path' }, { name: 'hits' }] } }),
  } as any;
}

describe('writes to a collection no page is built from', () => {
  beforeAll(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
  afterAll(() => TenantMode.reset());

  it('leave the site\'s revision where it was, for every kind of write', () => RequestContextUtils.storage.run({ locale: 'bg', tenantId: 't1' }, async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager(false), security);
    const before = SiteContentRevision.current('t1');
    await db.insert('fcp_alpha_log', { path: '/x', hits: 1 });
    await db.update('fcp_alpha_log', { id: 1 }, { hits: 2 });
    await db.delete('fcp_alpha_log', { id: 1 });
    expect(SiteContentRevision.current('t1')).toBe(before);
  }));

  it('still move it for a collection that does not declare it', () => RequestContextUtils.storage.run({ locale: 'bg', tenantId: 't1' }, async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager(undefined), security);
    const before = SiteContentRevision.current('t1');
    await db.insert('fcp_alpha_log', { path: '/x', hits: 1 });
    expect(SiteContentRevision.current('t1')).not.toBe(before);
  }));
});
