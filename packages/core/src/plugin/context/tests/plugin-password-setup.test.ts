import { createHash } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { UsersContextProxy } from '@core/plugin/context/users';

/**
 * `context.users.issuePasswordSetup` — the replacement for plugins writing reset tokens into meta by
 * hand, which let any plugin mint a reset link for the administrator. It issues the framework's own
 * token format, and only for an account the plugin could have created.
 */

const ROLES = [
  { slug: 'admin', permissions: ['*'] },
  { slug: 'customer', permissions: [] },
  { slug: 'partner', permissions: [] },
];

function managerWith(users: any[], memberships: any[] = []) {
  const meta = new Map<string, string>();
  const db = {
    find: vi.fn(async (table: string) => (table === SystemConstants.TABLE.ROLES ? ROLES : [])),
    findOne: vi.fn(async (table: string, where: any) => {
      if (table === SystemConstants.TABLE.USERS) return users.find((u) => u.id === where.id) ?? null;
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
        return memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
      }
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
  return { manager: { db, audit } as any, meta, db, audit };
}

const ALLOWED = { hasCapability: () => true, handleViolation: () => {}, handleRateLimit: () => {} } as any;
const users = (manager: any, security = ALLOWED) =>
  UsersContextProxy.createUsersProxy({ manifest: { slug: 'shop' } } as any, manager, security);

afterEach(() => TenantMode.reset());

describe('context.users.issuePasswordSetup', () => {
  it('issues a token in the framework’s reset format, as platform rows', async () => {
    const { manager, meta, db } = managerWith([{ id: 7, email: 'Partner@Site.test', roles: ['customer', 'partner'] }]);

    const { token, expiresAt } = await users(manager).issuePasswordSetup(7, { ttlMinutes: 7 * 24 * 60 });

    const hash = createHash('sha256').update(token).digest('hex');
    expect(meta.get('user:7:password_reset_token_hash')).toBe(hash);
    expect(JSON.parse(String(meta.get(`auth:password_reset_token:${hash}`)))).toEqual({ userId: 7, email: 'partner@site.test', expiresAt });
    expect(db.withPlatformAdmin).toHaveBeenCalled();
  });

  it('retires the previous link for the same account', async () => {
    const { manager, meta } = managerWith([{ id: 7, email: 'p@site.test', roles: ['customer'] }]);

    const first = await users(manager).issuePasswordSetup(7);
    await users(manager).issuePasswordSetup(7);

    const firstHash = createHash('sha256').update(first.token).digest('hex');
    expect(meta.has(`auth:password_reset_token:${firstHash}`)).toBe(false);
  });

  it('refuses an administrator — the takeover this replaces — and writes nothing', async () => {
    const { manager, meta, audit } = managerWith([{ id: 1, email: 'owner@site.test', roles: ['admin'] }]);

    await expect(users(manager).issuePasswordSetup(1)).rejects.toThrow(/refused role/);
    expect(meta.size).toBe(0);
    expect(audit.logAction).toHaveBeenCalledWith('shop', 'Password Setup', 'users', 'denied');
  });

  it('refuses a platform administrator whatever roles the row lists', async () => {
    const { manager, meta } = managerWith([{ id: 2, email: 'op@platform.test', roles: ['customer'], is_platform_admin: true }]);

    await expect(users(manager).issuePasswordSetup(2)).rejects.toThrow(/platform administrator/);
    expect(meta.size).toBe(0);
  });

  it('refuses an account that is an administrator on THIS site, even if a customer globally', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const { manager, meta } = managerWith(
      [{ id: 3, email: 'owner@site.test', roles: ['customer'] }],
      [{ user_id: '3', tenant_id: 'my-site', roles: ['admin'], state: 'active' }],
    );

    await expect(RequestContextUtils.storage.run({ tenantId: 'my-site' } as any, () => users(manager).issuePasswordSetup(3))).rejects.toThrow(/"admin"/);
    expect(meta.size).toBe(0);
  });

  it('refuses an account that does not belong to this site', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const { manager } = managerWith([{ id: 4, email: 'elsewhere@other.test', roles: ['customer'] }]);

    await expect(RequestContextUtils.storage.run({ tenantId: 'my-site' } as any, () => users(manager).issuePasswordSetup(4))).rejects.toThrow(/not a member/);
  });

  it('needs the same capability as creating the account', async () => {
    const { manager } = managerWith([{ id: 7, email: 'p@site.test', roles: ['customer'] }]);
    const denied = { hasCapability: () => false, handleViolation: (cap: string) => { throw new Error(`Missing "${cap}"`); }, handleRateLimit: () => {} } as any;

    await expect(users(manager, denied).issuePasswordSetup(7)).rejects.toThrow(/database:write/);
  });
});
