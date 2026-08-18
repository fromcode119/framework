import { describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '../database';

const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;

const security = {
  hasCapability: () => true,
  handleViolation: vi.fn(),
  handleRateLimit: vi.fn(),
} as any;

const buildManager = (row: Record<string, unknown>) => ({
  db: { findOne: vi.fn(async () => ({ ...row })) },
  audit: { logAction: vi.fn() },
  getCollection: () => ({ collection: { fields: [{ name: 'content', localized: true }] } }),
}) as any;

const LOCALIZED_ROW = { id: 5, content: JSON.stringify({ bg: 'къща', en: 'house' }) };

describe('context.db stored view', () => {
  it('the default view collapses a localized field to one locale value', async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    const row = await db.findOne('fcp_alpha_pages', { id: 5 });
    expect(typeof row.content).toBe('string');
    expect(['къща', 'house']).toContain(row.content);
  });

  it('db.stored returns the STORED locale map, so read-modify-write cannot destroy other locales', async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    const row = await db.stored.findOne('fcp_alpha_pages', { id: 5 });
    const parsed = JSON.parse(row.content);
    expect(Object.keys(parsed).sort()).toEqual(['bg', 'en']);
    expect(parsed.bg).toBe('къща');
    expect(parsed.en).toBe('house');
  });

  it('stored keeps the table isolation guard — another plugin\'s table still throws', async () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    await expect(async () => db.stored.findOne('fcp_beta_orders', { id: 1 })).rejects.toThrow(/Security Violation/);
  });

  it('stored on the stored view is itself, not an endless chain of proxies', () => {
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, buildManager(LOCALIZED_ROW), security);
    expect(db.stored.stored).toBe(db.stored);
  });
});
