import { beforeEach, describe, expect, it } from 'vitest';
import { EmailCategoryAudience } from '@fromcode119/core';
import { SystemEmailPreferencesController } from '@api/controllers/system/system-email-preferences-controller';

/**
 * An administrator's own switches for the alerts the site sends them.
 *
 * Three rules are load-bearing: the person is the SESSION's (never the body), only an administrator can
 * see or change an admin alert, and an alert marked `locked` cannot be switched off by anyone.
 */
describe('SystemEmailPreferencesController — administrator alerts', () => {
  let suppressed: Array<[string, string]>;
  let unsuppressed: Array<[string, string]>;

  const STREAMS: Record<string, any> = {
    'review-invitation': { key: 'review-invitation', labelKey: 'a', descriptionKey: 'b', pluginSlug: 'sp', audience: EmailCategoryAudience.PERSON },
    'admin-low-stock': { key: 'admin-low-stock', labelKey: 'shop.alerts.lowStock', descriptionKey: 'shop.alerts.lowStockHelp', pluginSlug: 'shop', audience: EmailCategoryAudience.ADMIN },
    'admin-certificate-expiry': { key: 'admin-certificate-expiry', labelKey: 'x', descriptionKey: 'y', pluginSlug: 'core', audience: EmailCategoryAudience.ADMIN, locked: true },
  };

  const controller = () => {
    const manager = {
      emailCategories: {
        list: (audience?: EmailCategoryAudience) => Object.values(STREAMS).filter((c) => !audience || c.audience === audience),
        get: (key: string) => STREAMS[key],
      },
      integrations: {
        email: {
          isSuppressed: async (_a: string, category: string) => category === 'admin-low-stock',
          suppress: async (a: string, c: string) => { suppressed.push([a, c]); },
          unsuppress: async (a: string, c: string) => { unsuppressed.push([a, c]); },
        },
      },
    };
    return new SystemEmailPreferencesController(manager as any, (_key: string, fallback: string) => fallback);
  };

  const response = () => {
    const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(payload: unknown) { this.body = payload; return this; } };
    return res;
  };
  const admin = { email: 'Owner@Example.com', roles: ['admin'] };
  const member = { email: 'member@example.com', roles: ['member'] };

  beforeEach(() => { suppressed = []; unsuppressed = []; });

  it('lists only the alerts, with the locked one held on, to an administrator', async () => {
    const res = response();
    await controller().list({ user: admin, query: { audience: 'admin' } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.preferences.map((p: any) => [p.key, p.subscribed, p.locked])).toEqual([
      ['admin-low-stock', false, false],
      ['admin-certificate-expiry', true, true],
    ]);
    // Nothing a server dictionary cannot word is invented: the caller gets the key to word it itself.
    expect(res.body.preferences[1].label).toBe('');
    expect(res.body.preferences[1].labelKey).toBe('x');
  });

  it('never mixes the alerts into the account screen', async () => {
    const res = response();
    await controller().list({ user: admin, query: {} } as any, res);
    expect(res.body.preferences.map((p: any) => p.key)).toEqual(['review-invitation']);
  });

  it('refuses to list the alerts to someone who is not an administrator', async () => {
    const res = response();
    await controller().list({ user: member, query: { audience: 'admin' } } as any, res);
    expect(res.statusCode).toBe(403);
  });

  it('switches an alert off for the SESSION address only', async () => {
    const res = response();
    await controller().update({ user: admin, body: { key: 'admin-low-stock', subscribed: false, address: 'victim@example.com' } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(suppressed).toEqual([['owner@example.com', 'admin-low-stock']]);
  });

  it('switches it back on', async () => {
    const res = response();
    await controller().update({ user: admin, body: { key: 'admin-low-stock', subscribed: true } } as any, res);
    expect(unsuppressed).toEqual([['owner@example.com', 'admin-low-stock']]);
  });

  it('refuses a non-administrator changing an alert', async () => {
    const res = response();
    await controller().update({ user: member, body: { key: 'admin-low-stock', subscribed: false } } as any, res);
    expect(res.statusCode).toBe(403);
    expect(suppressed).toEqual([]);
  });

  it('refuses to switch off a locked alert, even for an administrator', async () => {
    const res = response();
    await controller().update({ user: admin, body: { key: 'admin-certificate-expiry', subscribed: false } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(suppressed).toEqual([]);
  });
});
