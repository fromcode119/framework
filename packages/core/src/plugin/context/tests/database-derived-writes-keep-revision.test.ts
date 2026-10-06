import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteContentRevision } from '@core/tenant/site-content-revision';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * Every write a plugin makes moves its site's revision, and with it every kept answer of the site. A
 * plugin that stores a page it derived — a `readOnRequest` field — beside the record it comes from
 * wrote it when a visitor asked for it, and so threw away every kept answer to store one. A write that
 * touches nothing but such fields changed nothing a page is made of: it no longer moves the revision.
 */
const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

function manager() {
  return {
    db: { update: vi.fn(async () => ({ id: 1 })) },
    audit: { logAction: vi.fn() },
    getCollection: () => ({ collection: { fields: [{ name: 'title' }, { name: 'publicPage', readOnRequest: true }, { name: 'pageValidUntil', readOnRequest: true }] } }),
  } as any;
}

const revisionAfter = async (data: Record<string, unknown>) => {
  const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager(), security);
  const before = SiteContentRevision.current('t1');
  await db.update('fcp_alpha_items', { id: 1 }, data);
  return { before, after: SiteContentRevision.current('t1') };
};

describe('writes that only store what the plugin derives', () => {
  beforeAll(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
  afterAll(() => TenantMode.reset());

  it('leave the site\'s revision where it was', () => RequestContextUtils.storage.run({ locale: 'bg', tenantId: 't1' }, async () => {
    const { before, after } = await revisionAfter({ publicPage: { bg: { name: 'x' } }, pageValidUntil: '2030-01-01T00:00:00.000Z' });
    expect(after).toBe(before);
  }));

  it('still move it when the write touches any field of the record\'s own', () => RequestContextUtils.storage.run({ locale: 'bg', tenantId: 't1' }, async () => {
    const { before, after } = await revisionAfter({ publicPage: null, title: 'New' });
    expect(after).not.toBe(before);
  }));

  it('still move it for an insert, a delete and an empty update', () => RequestContextUtils.storage.run({ locale: 'bg', tenantId: 't1' }, async () => {
    const m = manager();
    m.db.insert = vi.fn(async () => ({ id: 2 }));
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, m, security);
    const before = SiteContentRevision.current('t1');
    await db.insert('fcp_alpha_items', { publicPage: null });
    expect(SiteContentRevision.current('t1')).not.toBe(before);
    const mid = SiteContentRevision.current('t1');
    await db.update('fcp_alpha_items', { id: 1 }, {});
    expect(SiteContentRevision.current('t1')).not.toBe(mid);
  }));
});
