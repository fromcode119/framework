import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailCategoryAudience, SystemConstants } from '@fromcode119/core';
import { SystemUserEmailPreferencesController } from '@api/controllers/system/system-user-email-preferences-controller';

/**
 * An administrator setting another person's alert switches.
 *
 * The account is the ROUTE's `:id` (never the body), it must be a member of the caller's site, and the
 * alerts sent to administrators are offered only for an account that is itself an administrator.
 */
describe('SystemUserEmailPreferencesController', () => {
  let suppressed: Array<[string, string, string]>;

  const USERS = [
    { id: 17, email: 'Boss@Site.test', roles: ['admin'] },
    { id: 18, email: 'staff@site.test', roles: ['member'] },
  ];
  const STREAMS: Record<string, any> = {
    broadcast: { key: 'broadcast', labelKey: 'a', descriptionKey: 'b', pluginSlug: 'bc', audience: EmailCategoryAudience.PERSON },
    'admin-low-stock': { key: 'admin-low-stock', labelKey: 'c', descriptionKey: 'd', pluginSlug: 'shop', audience: EmailCategoryAudience.ADMIN },
  };

  const controller = () => {
    const manager = {
      db: {
        find: vi.fn(async (table: string) => {
          if (table === SystemConstants.TABLE.USERS_ROLES) return [{ user_id: 17 }];
          if (table === SystemConstants.TABLE.USERS) return USERS;
          return [];
        }),
        findOne: vi.fn(async (table: string, where: any) => (table === SystemConstants.TABLE.USERS ? USERS.find((u) => u.id === where.id) ?? null : null)),
      },
      emailCategories: {
        list: (audience?: EmailCategoryAudience) => Object.values(STREAMS).filter((c) => !audience || c.audience === audience),
        get: (key: string) => STREAMS[key],
      },
      integrations: { email: { isSuppressed: async () => false, suppress: async (a: string, c: string, s: string) => { suppressed.push([a, c, s]); }, unsuppress: async () => undefined } },
    };
    return new SystemUserEmailPreferencesController(manager as any, (_k: string, fallback: string) => fallback);
  };
  const response = () => { const res: any = { statusCode: 200, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(p: unknown) { this.body = p; return this; } }; return res; };

  beforeEach(() => { suppressed = []; });

  it("lists an administrator's alerts for the account in the route", async () => {
    const res = response();
    await controller().list({ params: { id: '17' }, query: { audience: 'admin' }, user: { id: 1 } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.address).toBe('boss@site.test');
    expect(res.body.preferences.map((p: any) => p.key)).toEqual(['admin-low-stock']);
  });

  it('offers no administrator alerts for an account that is not an administrator', async () => {
    const res = response();
    await controller().list({ params: { id: '18' }, query: { audience: 'admin' }, user: { id: 1 } } as any, res);
    expect(res.statusCode).toBe(403);
  });

  it("still lists a non-administrator's own optional emails", async () => {
    const res = response();
    await controller().list({ params: { id: '18' }, query: {}, user: { id: 1 } } as any, res);
    expect(res.body.preferences.map((p: any) => p.key)).toEqual(['broadcast']);
  });

  it('acts on the account in the ROUTE, ignoring any address in the body', async () => {
    const res = response();
    await controller().update({ params: { id: '17' }, body: { key: 'admin-low-stock', subscribed: false, address: 'victim@x.test', userId: 18 }, user: { id: 1 } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(suppressed).toEqual([['boss@site.test', 'admin-low-stock', 'admin:user-preferences']]);
  });

  it('refuses an admin alert for an account that is not an administrator', async () => {
    const res = response();
    await controller().update({ params: { id: '18' }, body: { key: 'admin-low-stock', subscribed: false }, user: { id: 1 } } as any, res);
    expect(res.statusCode).toBe(403);
    expect(suppressed).toEqual([]);
  });

  it('answers not found for an unknown account, never touching the list', async () => {
    const res = response();
    await controller().update({ params: { id: '999' }, body: { key: 'broadcast', subscribed: false }, user: { id: 1 } } as any, res);
    expect(res.statusCode).toBe(404);
    expect(suppressed).toEqual([]);
  });
});
