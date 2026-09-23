import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Schema } from '@fromcode119/database';
import { PluginTenantAccess, RequestContextUtils, SystemConstants, TenantMode } from '@fromcode119/core';
import { UserManagementService } from '@api/services/user-management-service';

/**
 * Roles as a SITE sees them.
 *
 * On a site, a member is authorized by their membership's roles, not the account's platform-wide ones.
 * The Users screens read and wrote the platform-wide ones, so inside a site:
 *   - the list named roles that do nothing there (a plugin-free site showed `partner` on its admin);
 *   - "Manage roles" saved, said it had, and changed nothing on the site;
 *   - the Roles screen counted "Administrator: 0 users" on a site that had one.
 */
class FakeDb {
  userRoles: Array<{ userId: number; roleSlug: string }>;
  memberships: any[];

  constructor(private readonly roles: any[], userRoles: Array<{ userId: number; roleSlug: string }>, memberships: any[], private readonly users: any[]) {
    this.userRoles = [...userRoles];
    this.memberships = memberships.map((row) => ({ ...row }));
  }

  eq(_column: unknown, value: unknown) { return { eq: value }; }
  inArray(_column: unknown, values: unknown[]) { return { in: values }; }

  async find(table: unknown, options?: any) {
    if (table === Schema.systemRoles) return this.roles;
    if (table === Schema.systemUsersToRoles) {
      const value = options?.where?.eq;
      return this.userRoles.filter((row) => row.userId === value || row.roleSlug === value);
    }
    if (table === Schema.users) return this.users;
    if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
      return this.memberships.filter((row) => row.tenant_id === options?.where?.tenant_id);
    }
    return [];
  }

  async findOne(table: unknown, where: any) {
    if (table === Schema.users) return this.users.find((user) => user.id === where.id) ?? null;
    if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
      return this.memberships.find((row) => row.user_id === where.user_id && row.tenant_id === where.tenant_id) ?? null;
    }
    return null;
  }

  async update(table: unknown, where: any, patch: any) {
    if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
      const row = this.memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id);
      Object.assign(row, patch);
    }
    return undefined;
  }

  async delete(_table: unknown, where: any) {
    this.userRoles = this.userRoles.filter((row) => row.userId !== where.userId);
    return true;
  }

  async insert(_table: unknown, row: any) { this.userRoles.push(row); return row; }
}

const ROLES = [
  { slug: 'admin', pluginSlug: '' },
  { slug: 'editor', pluginSlug: 'system' },
  { slug: 'partner', pluginSlug: 'mlm' },
  { slug: 'author', pluginSlug: 'cms' },
];

const makeService = () => {
  const db = new FakeDb(
    ROLES,
    // Platform-wide: admin and partner.
    [{ userId: 7, roleSlug: 'admin' }, { userId: 7, roleSlug: 'partner' }, { userId: 8, roleSlug: 'admin' }],
    [
      { user_id: '7', tenant_id: 'plain-site', roles: '["editor"]', state: 'active' },
      { user_id: '8', tenant_id: 'plain-site', roles: '["admin","partner"]', state: 'active' },
      { user_id: '7', tenant_id: 'other-site', roles: '["admin"]', state: 'active' },
    ],
    [{ id: 7, email: 'a@x.test', roles: ['admin', 'partner'] }, { id: 8, email: 'b@x.test', roles: ['admin', 'partner'] }],
  );
  return { db, service: new UserManagementService(db as any, {} as any, {} as any) };
};

const inSite = <T>(fn: () => Promise<T>): Promise<T> =>
  RequestContextUtils.storage.run({ tenantId: 'plain-site' } as any, fn);

beforeEach(() => {
  TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
  vi.spyOn(PluginTenantAccess, 'enabledSlugsFor').mockReturnValue(new Set(['cms'])); // the site runs cms only
});

afterEach(() => {
  TenantMode.reset();
  vi.restoreAllMocks();
});

describe('inside a site', () => {
  it('lists each member with the roles their membership grants there', async () => {
    const { service } = makeService();
    const users = await inSite(() => service.getUsers([7, 8]));
    expect(users.map((user: any) => [user.id, user.roles])).toEqual([[7, ['editor']], [8, ['admin']]]);
  });

  it('leaves out a role owned by a plugin the site does not run', async () => {
    const { service } = makeService();
    const user = await inSite(() => service.getUser(8));
    expect(user?.roles).toEqual(['admin']);
  });

  it('saves a role change to the membership, and leaves platform-wide grants alone', async () => {
    const { db, service } = makeService();
    await inSite(() => service.saveUserRoles(7, ['admin', 'author']));

    const membership = db.memberships.find((row) => row.user_id === '7' && row.tenant_id === 'plain-site');
    expect(JSON.parse(membership.roles)).toEqual(['admin', 'author']);
    expect(db.userRoles.filter((row) => row.userId === 7).map((row) => row.roleSlug)).toEqual(['admin', 'partner']);
    // The member's other site is untouched.
    expect(db.memberships.find((row) => row.tenant_id === 'other-site').roles).toBe('["admin"]');
  });

  it('does the same through a full user save', async () => {
    const { db, service } = makeService();
    await inSite(() => service.saveUser(7, { email: 'a@x.test', roles: ['admin'] }));

    expect(JSON.parse(db.memberships.find((row) => row.user_id === '7' && row.tenant_id === 'plain-site').roles)).toEqual(['admin']);
    expect(db.userRoles.filter((row) => row.userId === 7).map((row) => row.roleSlug)).toEqual(['admin', 'partner']);
  });

  it('cannot grant a role the site is not shown', async () => {
    const { db, service } = makeService();
    await inSite(() => service.saveUserRoles(7, ['admin', 'partner']));
    expect(JSON.parse(db.memberships.find((row) => row.user_id === '7' && row.tenant_id === 'plain-site').roles)).toEqual(['admin']);
  });

  it('counts a role’s holders from the memberships', async () => {
    const { service } = makeService();
    const roles = await inSite(() => service.getRoles());
    expect(roles.map((role: any) => [role.slug, role.users])).toEqual([['admin', 1], ['editor', 1], ['author', 0]]);
  });
});

describe('in the platform scope', () => {
  it('still shows and saves platform-wide roles', async () => {
    const { db, service } = makeService();
    const [user] = await service.getUsers([7]);
    expect(user.roles.sort()).toEqual(['admin', 'partner']);

    await service.saveUserRoles(7, ['admin']);
    expect(db.userRoles.filter((row) => row.userId === 7).map((row) => row.roleSlug)).toEqual(['admin']);
  });
});
