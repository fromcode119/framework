import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantMembershipService, TenantMode } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';

/**
 * Global roles are not platform administration.
 *
 * On a multi-site deployment an account could carry a global `admin` role without being the platform
 * admin (a site administrator created before memberships, an imported account). A session with no site
 * selected carried those global roles, and every permission gate not also behind PlatformAdminGuard let
 * it through — the platform's own screens included. And inside a site, a member whose membership held
 * no roles fell back to the account's global ones whenever a permission was checked.
 */
describe('roles outside a site', () => {
  afterEach(() => {
    TenantMode.reset();
    vi.restoreAllMocks();
  });

  const multiSite = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

  it('gives a non-platform-admin nothing in platform scope, and keeps the platform admin whole', async () => {
    multiSite();
    const service = new TenantMembershipService({} as any);
    const isPlatformAdmin = vi.spyOn(service as any, 'isPlatformAdmin');
    isPlatformAdmin.mockResolvedValueOnce(false);
    await expect(service.rolesOutsideSite('2')).resolves.toEqual([]);
    isPlatformAdmin.mockResolvedValueOnce(true);
    await expect(service.rolesOutsideSite('247')).resolves.toBeNull();
  });

  it('keeps global roles on a single-site deployment, where every admin is the platform', async () => {
    await expect(new TenantMembershipService({} as any).rolesOutsideSite('2')).resolves.toBeNull();
  });

  it('asks the resolver even when no site is bound', async () => {
    const auth = new AuthManager('test-secret');
    const resolver = vi.fn(async (_userId: string, tenantId: string) => (tenantId ? ['editor'] : []));
    auth.useTenantRoles(resolver);
    const narrowed = await (auth as any).applyTenantRoles({ id: '2', roles: ['admin'] }, '');
    expect(resolver).toHaveBeenCalledWith('2', '');
    expect(narrowed.roles).toEqual([]);
  });

  it('never falls back to global roles when the roles in effect are an empty list', async () => {
    const auth = new AuthManager('test-secret');
    const checker = {
      hasPermissionForRoles: vi.fn(async (roles: string[]) => roles.includes('admin')),
      hasPermission: vi.fn(async () => true),
    };
    auth.setPermissionChecker(checker as any);
    const res: any = { code: 200 };
    res.status = (code: number) => { res.code = code; return res; };
    res.json = () => res;
    const next = vi.fn();

    await auth.requirePermission('users:manage')({ user: { id: '3', roles: [] }, method: 'PUT', url: '/x' }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(403);
    expect(checker.hasPermission).not.toHaveBeenCalled();
  });
});
