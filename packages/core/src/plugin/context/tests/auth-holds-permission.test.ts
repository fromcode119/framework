import { vi } from 'vitest';
import { AuthContextProxy } from '@core/plugin/context/auth';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * `context.auth.holdsPermission(userId, permission)` answers what `requirePermission` answers for a
 * signed-in request, for a credential a plugin issued itself — so taking an account's role or its
 * membership away stops that credential at once instead of when it expires.
 */
describe('AuthContextProxy.holdsPermission', () => {
  const memberships: Record<string, { roles: string[]; state: string }> = {
    '1': { roles: ['bridge-user'], state: 'active' },
    '3': { roles: ['bridge-user'], state: 'suspended' },
  };
  const db = {
    findOne: async (table: string, where: Record<string, unknown>) => {
      if (table === SystemConstants.TABLE.USERS) return { id: where.id, is_platform_admin: where.id === '9' };
      if (table === SystemConstants.TABLE.TENANTS) return where.id === 'site-a' ? { id: 'site-a' } : null;
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
        const row = where.tenant_id === 'site-a' ? memberships[String(where.user_id)] : undefined;
        return row ? { user_id: where.user_id, tenant_id: where.tenant_id, roles: row.roles, state: row.state } : null;
      }
      return null;
    },
  };
  const managerAnswering = (answer: boolean | Error) => ({
    holdsPermission: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  });
  const onSite = <T>(tenantId: string | undefined, work: () => Promise<T>): Promise<T> =>
    RequestContextUtils.storage.run({ tenantId } as never, work);

  it('asks the request gate with the membership roles of a member of this site', async () => {
    const manager = managerAnswering(true);
    const auth = AuthContextProxy.createAuthProxy(manager, db);

    await expect(onSite('site-a', () => auth.holdsPermission(1, 'bridge:use'))).resolves.toBe(true);
    expect(manager.holdsPermission).toHaveBeenCalledWith({ user: { id: '1', roles: ['bridge-user'] } }, ['bridge:use']);
  });

  it('refuses, without asking, an account that may not enter this site', async () => {
    const manager = managerAnswering(true);
    const auth = AuthContextProxy.createAuthProxy(manager, db);

    await expect(onSite('site-a', () => auth.holdsPermission(2, 'bridge:use'))).resolves.toBe(false);
    await expect(onSite('site-a', () => auth.holdsPermission(3, 'bridge:use'))).resolves.toBe(false);
    expect(manager.holdsPermission).not.toHaveBeenCalled();
  });

  it('lets a platform admin who is no member here keep its global roles, as a request does', async () => {
    const manager = managerAnswering(true);
    const auth = AuthContextProxy.createAuthProxy(manager, db);

    await expect(onSite('site-a', () => auth.holdsPermission(9, 'bridge:use'))).resolves.toBe(true);
    expect(manager.holdsPermission).toHaveBeenCalledWith({ user: { id: '9' } }, ['bridge:use']);
  });

  it('passes on the gate refusing the roles in effect', async () => {
    const auth = AuthContextProxy.createAuthProxy(managerAnswering(false), db);

    await expect(onSite('site-a', () => auth.holdsPermission(1, 'bridge:use'))).resolves.toBe(false);
  });

  it('fails closed on a missing account, a missing permission, and an error', async () => {
    const auth = AuthContextProxy.createAuthProxy(managerAnswering(new Error('db down')), db);

    await expect(onSite('site-a', () => auth.holdsPermission(1, 'bridge:use'))).resolves.toBe(false);
    await expect(onSite('site-a', () => auth.holdsPermission('', 'bridge:use'))).resolves.toBe(false);
    await expect(onSite('site-a', () => auth.holdsPermission(1, ''))).resolves.toBe(false);
    await expect(AuthContextProxy.createAuthProxy(null).holdsPermission(1, 'bridge:use')).resolves.toBe(false);
  });
});
