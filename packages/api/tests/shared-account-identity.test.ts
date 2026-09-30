import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RequestContextUtils, TenantMode } from '@fromcode119/core';
import { SystemUserController } from '@api/controllers/system/system-user-controller';
import { UserCollectionScopeGuard } from '@api/services/user-collection-scope-guard';
import { TenantUserScope } from '@api/services/request/tenant-user-scope';

/**
 * A site sees its members, but it does not own every member's ACCOUNT.
 *
 * `users` is one table for the whole platform: an account that also belongs to another site — or is
 * the platform admin — signs in with the same email and password everywhere. Before this rule a site's
 * administrator could set such an account's password (the platform admin's, when the platform admin was
 * a member of that site) and then sign in as it on every other site, or delete it everywhere.
 *
 * Fixture: site `acme` has members 1 (acme only), 2 (also administers `globex`) and 247 (the platform
 * admin). The caller is user 1, an administrator of acme and nothing else.
 */
describe('a site cannot change or delete an account it shares with another site', () => {
  const memberships = [
    { user_id: '1', tenant_id: 'acme', roles: '["admin"]', state: 'active' },
    { user_id: '2', tenant_id: 'acme', roles: '["admin"]', state: 'active' },
    { user_id: '2', tenant_id: 'globex', roles: '["admin"]', state: 'active' },
    { user_id: '247', tenant_id: 'acme', roles: '["admin"]', state: 'active' },
  ];
  const users: Record<string, any> = {
    1: { id: 1, email: 'one@acme.test', username: 'one', firstName: 'One', lastName: 'Tenant', is_platform_admin: false },
    2: { id: 2, email: 'both@x.test', username: 'both', firstName: 'Both', lastName: 'Tenants', is_platform_admin: false },
    247: { id: 247, email: 'owner@platform.test', username: 'owner', firstName: 'Plat', lastName: 'Form', is_platform_admin: true },
  };

  const db = () => ({
    find: vi.fn(async (table: string, options: any = {}) => {
      const where = options?.where ?? {};
      if (String(table).includes('membership')) {
        if (where.tenant_id) return memberships.filter((row) => row.tenant_id === where.tenant_id);
        if (where.user_id?.in) return memberships.filter((row) => where.user_id.in.includes(row.user_id));
        if (where.user_id) return memberships.filter((row) => row.user_id === where.user_id);
        return memberships;
      }
      if (where.is_platform_admin === true) return Object.values(users).filter((user) => user.is_platform_admin);
      return [];
    }),
    findOne: vi.fn(async (table: string, where: any) => {
      if (String(table).includes('membership')) {
        return memberships.find((row) => row.user_id === where.user_id && row.tenant_id === where.tenant_id) ?? null;
      }
      return users[String(where?.id)] ?? null;
    }),
    delete: vi.fn(async () => true),
    update: vi.fn(async () => ({})),
    insert: vi.fn(async () => ({})),
  });

  const setup = (callerId = '1') => {
    const database = db();
    const runtime: any = {
      db: database,
      users: {
        saveUser: vi.fn(async (id: number | null) => id ?? 999),
        deleteUser: vi.fn(async () => true),
        getUser: vi.fn(async (id: number) => {
          const { is_platform_admin, ...user } = users[String(id)] ?? {};
          void is_platform_admin;
          return users[String(id)] ? user : null;
        }),
      },
    };
    const request = (params: any = {}, body: any = {}) => ({ params, body, user: { id: callerId } }) as any;
    return { controller: new SystemUserController(runtime), runtime, database, request };
  };

  const respond = () => {
    const res: any = { body: null, code: 200 };
    res.status = (c: number) => { res.code = c; return res; };
    res.json = (b: unknown) => { res.body = b; return res; };
    return res;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('acme');
  });

  it('refuses to set the platform admin\'s password from inside a site', async () => {
    const { controller, runtime, request } = setup();
    const res = respond();

    await controller.saveUser(request({ id: '247' }, { ...users[247], password: 'taken-over' }), res);

    expect(res.code).toBe(403);
    expect(res.body.error).toBe('identity_managed_by_platform');
    expect(runtime.users.saveUser).not.toHaveBeenCalled();
  });

  it('refuses to change the email of a member who also belongs to another site', async () => {
    const { controller, runtime, request } = setup();
    const res = respond();

    await controller.saveUser(request({ id: '2' }, { ...users[2], email: 'attacker@evil.test' }), res);

    expect(res.code).toBe(403);
    expect(runtime.users.saveUser).not.toHaveBeenCalled();
  });

  it('still saves a shared member\'s roles when the sign-in fields are resent unchanged — without rewriting the account', async () => {
    // The admin form resends every field on every save; a roles change must keep working.
    const { controller, runtime, request } = setup();
    const res = respond();
    const { is_platform_admin, ...form } = users[2];
    void is_platform_admin;

    await controller.saveUser(request({ id: '2' }, { ...form, email: 'BOTH@x.test', roles: ['editor'] }), res);

    expect(res.body).toMatchObject({ success: true });
    expect(runtime.users.saveUser).toHaveBeenCalledWith(2, expect.anything(), { identity: false });
  });

  it('lets a site change the account of a member that belongs to it alone', async () => {
    const { controller, runtime, request } = setup('2');
    const res = respond();

    await controller.saveUser(request({ id: '1' }, { ...users[1], password: 'new-secret' }), res);

    expect(res.body).toMatchObject({ success: true });
    expect(runtime.users.saveUser).toHaveBeenCalledWith(1, expect.anything(), { identity: true });
  });

  it('turns "delete" of a shared account into removing it from this site only', async () => {
    const { controller, runtime, database, request } = setup();
    const res = respond();

    await controller.deleteUser(request({ id: '2' }), res);

    expect(res.body).toEqual({ success: true, removedFromSite: true });
    expect(runtime.users.deleteUser).not.toHaveBeenCalled();
    expect(database.delete).toHaveBeenCalledWith(expect.stringContaining('membership'), { user_id: '2', tenant_id: 'acme' });
  });

  it('marks the shared account read-only for the form, and does not reveal who is the platform admin', async () => {
    const { controller, request } = setup();
    const res = respond();

    await controller.getUser(request({ id: '247' }), res);

    expect(res.body.identityLocked).toBe(true);
    expect(res.body).not.toHaveProperty('is_platform_admin');
    expect(res.body).not.toHaveProperty('isPlatformAdmin');
  });

  it('gives the platform admin full reach over a shared account, even inside a site', async () => {
    // The platform stands above every site.
    const { controller, runtime, request } = setup('247');
    const res = respond();

    await controller.saveUser(request({ id: '2' }, { ...users[2], password: 'reset-by-platform' }), res);

    expect(res.body).toMatchObject({ success: true });
    expect(runtime.users.saveUser).toHaveBeenCalledWith(2, expect.anything(), { identity: true });
  });

  it('closes the generic collection API the same way', async () => {
    const scope = await TenantUserScope.of({ user: { id: '1' } }, db());

    expect(UserCollectionScopeGuard.allows(scope, 2)).toBe(true);
    expect(UserCollectionScopeGuard.allowsWrite(scope, 2)).toBe(false);
    expect(UserCollectionScopeGuard.allowsWrite(scope, 247)).toBe(false);
    expect(UserCollectionScopeGuard.allowsWrite(scope, 1)).toBe(true);
    expect(() => UserCollectionScopeGuard.ensureWriteAllowed(scope, 2)).toThrow(/not managed by this site/);
  });

  it('shows and ends only this site\'s sessions of a shared member', async () => {
    const scope = await TenantUserScope.of({ user: { id: '1' } }, db());

    expect(scope.allowsSession(2, 'acme')).toBe(true);
    expect(scope.allowsSession(2, 'globex')).toBe(false);
    expect(scope.allowsSession(2, null)).toBe(false);
  });
});
