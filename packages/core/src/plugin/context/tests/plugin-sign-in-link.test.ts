import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { UsersContextProxy } from '@core/plugin/context/users';
import { PluginSignInLink } from '@core/plugin/context/plugin-sign-in-link';

/**
 * `context.users.issueSignInLink` — a link that signs a plugin-created account in on any device. It is
 * vetted exactly like `issuePasswordSetup`, bound to the site, and keeps only one live link per account.
 */

const ROLES = [
  { slug: 'admin', permissions: ['*'] },
  { slug: 'customer', permissions: [] },
];

function managerWith(users: any[]) {
  const meta = new Map<string, string>();
  const db = {
    find: vi.fn(async (table: string, query?: any) => {
      if (table === SystemConstants.TABLE.ROLES) return ROLES;
      if (table === SystemConstants.TABLE.USERS && query?.where?.is_platform_admin) return users.filter((u) => u.is_platform_admin);
      return [];
    }),
    findOne: vi.fn(async (table: string, where: any) => {
      if (table === SystemConstants.TABLE.USERS) return users.find((u) => u.id === where.id) ?? null;
      if (table === SystemConstants.TABLE.META) return meta.has(where.key) ? { key: where.key, value: meta.get(where.key) } : null;
      return null;
    }),
    insert: vi.fn(async (_table: string, row: any) => { meta.set(row.key, row.value); return row; }),
    update: vi.fn(async (_table: string, where: any, patch: any) => { meta.set(where.key, patch.value); return patch; }),
    delete: vi.fn(async (_table: string, where: any) => { meta.delete(where.key); }),
    withPlatformAdmin: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    withTenant: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
  };
  const audit = { logAction: vi.fn() };
  return { manager: { db, audit } as any, meta, db };
}

const ALLOWED = { hasCapability: () => true, handleViolation: () => {}, handleRateLimit: () => {} } as any;
const users = (manager: any, security = ALLOWED) =>
  UsersContextProxy.createUsersProxy({ manifest: { slug: 'lms' } } as any, manager, security);

afterEach(() => TenantMode.reset());

describe('context.users.issueSignInLink', () => {
  it('stores the hashed token with the account, the landing path and the expiry', async () => {
    const { manager, meta, db } = managerWith([{ id: 7, email: 'Reader@Site.test', roles: ['customer'] }]);

    const { token, expiresAt } = await users(manager).issueSignInLink(7, { next: '/book/chapter-1' });

    const hash = PluginSignInLink.hash(token);
    expect(meta.get(PluginSignInLink.userKey(7))).toBe(hash);
    expect(JSON.parse(String(meta.get(PluginSignInLink.tokenKey(hash))))).toEqual({
      userId: 7, email: 'reader@site.test', tenantId: null, next: '/book/chapter-1', expiresAt,
    });
    expect(db.withPlatformAdmin).toHaveBeenCalled();
  });

  it('keeps one live link per account', async () => {
    const { manager, meta } = managerWith([{ id: 7, email: 'r@site.test', roles: ['customer'] }]);

    const first = await users(manager).issueSignInLink(7);
    await users(manager).issueSignInLink(7);

    expect(meta.has(PluginSignInLink.tokenKey(PluginSignInLink.hash(first.token)))).toBe(false);
  });

  it('clamps the lifetime between five minutes and three days', async () => {
    const { manager } = managerWith([{ id: 7, email: 'r@site.test', roles: ['customer'] }]);
    const before = Date.now();

    const short = await users(manager).issueSignInLink(7, { ttlMinutes: 1 });
    const long = await users(manager).issueSignInLink(7, { ttlMinutes: 99999 });

    expect(Date.parse(short.expiresAt) - before).toBeGreaterThanOrEqual(5 * 60 * 1000 - 50);
    expect(Date.parse(short.expiresAt) - before).toBeLessThan(6 * 60 * 1000);
    expect(Date.parse(long.expiresAt) - before).toBeLessThanOrEqual(3 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('refuses an administrator and writes nothing', async () => {
    const { manager, meta } = managerWith([{ id: 1, email: 'owner@site.test', roles: ['admin'] }]);

    await expect(users(manager).issueSignInLink(1)).rejects.toThrow(/refused role/);
    expect(meta.size).toBe(0);
  });

  it('needs the same capability as creating the account', async () => {
    const { manager } = managerWith([{ id: 7, email: 'r@site.test', roles: ['customer'] }]);
    const denied = { hasCapability: () => false, handleViolation: (cap: string) => { throw new Error(`Missing "${cap}"`); }, handleRateLimit: () => {} } as any;

    await expect(users(manager, denied).issueSignInLink(7)).rejects.toThrow(/database:write/);
  });
});

describe('PluginSignInLink.safeNext', () => {
  it('keeps a path on this site and drops anything that could leave it', () => {
    expect(PluginSignInLink.safeNext('/book?x=1')).toBe('/book?x=1');
    expect(PluginSignInLink.safeNext('//evil.test')).toBe('/');
    expect(PluginSignInLink.safeNext('/\\evil.test')).toBe('/');
    expect(PluginSignInLink.safeNext('https://evil.test')).toBe('/');
    expect(PluginSignInLink.safeNext(undefined)).toBe('/');
  });
});
