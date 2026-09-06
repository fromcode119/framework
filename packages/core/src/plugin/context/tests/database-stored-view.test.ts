import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '../database';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * Plugin `context.db` is tenant-scoped: an untenanted query THROWS rather than silently returning
 * every tenant's rows. These suites exercise other behaviour, so each test runs inside a tenant the
 * way a real request does. `enterWith` in a beforeEach does NOT work here — vitest runs the hook and
 * the test in separate async contexts, so the store has to wrap the test body itself.
 */
const tenantIt = (name: string, fn: () => unknown) =>
  it(name, () => RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, async () => { await fn(); }));


const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;

const security = {
  hasCapability: () => true,
  handleViolation: vi.fn(),
  handleRateLimit: vi.fn(),
} as any;

const buildManager = (row: Record<string, unknown>) => ({
  db: {
    findOne: vi.fn(async () => ({ ...row })),
    upsert: vi.fn(async () => ({ ...row })),
  },
  audit: { logAction: vi.fn() },
  getCollection: () => ({ collection: { fields: [{ name: 'content', localized: true }] } }),
}) as any;

const LOCALIZED_ROW = { id: 5, content: JSON.stringify({ bg: 'къща', en: 'house' }) };

describe('context.db stored view', () => {

  tenantIt('the default view collapses a localized field to one locale value', async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    const row = await db.findOne('fcp_alpha_pages', { id: 5 });
    expect(typeof row.content).toBe('string');
    expect(['къща', 'house']).toContain(row.content);
  });

  tenantIt('db.stored returns the STORED locale map, so read-modify-write cannot destroy other locales', async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    const row = await db.stored.findOne('fcp_alpha_pages', { id: 5 });
    const parsed = JSON.parse(row.content);
    expect(Object.keys(parsed).sort()).toEqual(['bg', 'en']);
    expect(parsed.bg).toBe('къща');
    expect(parsed.en).toBe('house');
  });

  tenantIt('stored keeps the table isolation guard — another plugin\'s table still throws', async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    await expect(async () => db.stored.findOne('fcp_beta_orders', { id: 1 })).rejects.toThrow(/Security Violation/);
  });

  tenantIt('upsert rows pass through denormalization and the localized collapse like insert', async () => {
    const manager = buildManager({ id: 5, page_title: 'Home', content: JSON.stringify({ bg: 'къща', en: 'house' }) });
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    const row = await db.upsert('fcp_alpha_pages', { id: 5 }, { target: 'id', set: {} });
    expect(row.pageTitle).toBe('Home');
    expect(typeof row.content).toBe('string');
    expect(['къща', 'house']).toContain(row.content);
  });

  tenantIt('stored upsert returns the STORED locale map, denormalized', async () => {
    const manager = buildManager({ id: 5, page_title: 'Home', content: JSON.stringify({ bg: 'къща', en: 'house' }) });
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    const row = await db.stored.upsert('fcp_alpha_pages', { id: 5 }, { target: 'id', set: {} });
    expect(row.pageTitle).toBe('Home');
    expect(Object.keys(JSON.parse(row.content)).sort()).toEqual(['bg', 'en']);
  });

  tenantIt('stored on the stored view is itself, not an endless chain of proxies', () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    expect(db.stored.stored).toBe(db.stored);
  });
});
