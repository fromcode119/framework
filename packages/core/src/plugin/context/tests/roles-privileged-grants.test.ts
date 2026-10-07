import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { RolesContextProxy } from '@core/plugin/context/roles';

/**
 * What a PLUGIN may grant or declare through `context.roles`.
 *
 * `context.users.create` refuses an administrator's role, but that alone is decorative if the next
 * line can be `roles.assignRole(id, 'admin')`. Pinned here: every write that gives a role — assign,
 * site membership, site role — and every role declaration goes through the same test, and a refusal
 * writes nothing.
 */

const PLATFORM_ROLES = [
  { slug: 'admin', permissions: ['*'] },
  { slug: 'editor', permissions: ['content:read', 'content:write'] },
  { slug: 'helper', permissions: ['*'] },
  { slug: 'customer', permissions: [] },
  // The calling plugin here is `shop`.
  { slug: 'shop-staff', permissions: ['shop:own'] },
  { slug: 'loyalty-partner', permissions: ['loyalty:dashboard'] },
];

function managerWith() {
  const memberships: any[] = [];
  const db = {
    find: vi.fn(async (table: string) => (table === SystemConstants.TABLE.ROLES ? PLATFORM_ROLES : [])),
    findOne: vi.fn(async (table: string, where: any) => {
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
        return memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
      }
      if (table === SystemConstants.TABLE.USERS) return { id: where.id, roles: ['customer'] };
      return null;
    }),
    insert: vi.fn(async (table: string, row: any) => {
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) memberships.push(row);
      return row;
    }),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => null),
    withTenant: vi.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
  };
  const audit = { logAction: vi.fn() };
  return { manager: { db, audit } as any, db, audit, memberships };
}

const roles = (manager: any) => RolesContextProxy.createRolesProxy(manager, 'shop');
const inSite = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
  RequestContextUtils.storage.run({ tenantId } as any, fn);
const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

afterEach(() => TenantMode.reset());

describe('context.roles.assignRole', () => {
  it.each([['admin'], [' Admin '], ['superadmin'], ['helper'], ['editor'], ['loyalty-partner']])('refuses %s and writes nothing', async (role) => {
    const { manager, db } = managerWith();

    await expect(roles(manager).assignRole(5, role)).rejects.toThrow(/context\.roles\.assignRole refused role/);

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('grants the plugin’s own roles and permissionless ones', async () => {
    const { manager, db } = managerWith();

    await roles(manager).assignRole(5, 'shop-staff');
    await roles(manager).assignRole(5, 'customer');

    expect(db.insert).toHaveBeenCalledWith(SystemConstants.TABLE.USERS_ROLES, { userId: 5, roleSlug: 'shop-staff' });
    expect(db.insert).toHaveBeenCalledWith(SystemConstants.TABLE.USERS_ROLES, { userId: 5, roleSlug: 'customer' });
  });

  it('records the refusal against the plugin', async () => {
    const { manager, audit } = managerWith();

    await expect(roles(manager).assignRole(5, 'admin')).rejects.toThrow();
    expect(audit.logAction).toHaveBeenCalledWith('shop', 'Role Grant', 'roles', 'denied');
  });
});

describe('context.roles site grants', () => {
  it('grantSiteMembership refuses an administrator membership, even beside a harmless role', async () => {
    multiTenant();
    const { manager, memberships, db } = managerWith();

    await expect(inSite('my-site', () => roles(manager).grantSiteMembership(5, ['customer', 'admin']))).rejects.toThrow(/grantSiteMembership/);

    expect(memberships).toEqual([]);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('grantSiteMembership still grants a customer, and a membership with no roles', async () => {
    multiTenant();
    const { manager, memberships } = managerWith();

    await inSite('my-site', () => roles(manager).grantSiteMembership(5, ['customer']));
    await inSite('my-site', () => roles(manager).grantSiteMembership(6));

    expect(memberships.map((m) => m.user_id)).toEqual(['5', '6']);
  });

  it('addSiteRole refuses admin on the site and writes no membership', async () => {
    multiTenant();
    const { manager, memberships } = managerWith();

    await expect(inSite('my-site', () => roles(manager).addSiteRole(5, 'admin'))).rejects.toThrow(/addSiteRole/);
    expect(memberships).toEqual([]);
  });

  it('addSiteRole adds the plugin’s own role', async () => {
    multiTenant();
    const { manager, memberships } = managerWith();

    await inSite('my-site', () => roles(manager).addSiteRole(5, 'shop-staff'));

    expect(memberships).toEqual([expect.objectContaining({ user_id: '5', tenant_id: 'my-site' })]);
  });
});

describe('context.roles.ensure', () => {
  it('refuses to declare a role carrying a wildcard, a platform permission, or another plugin’s', async () => {
    const { manager, db } = managerWith();

    await expect(roles(manager).ensure('shop-root', { name: 'Root', permissions: ['*'] })).rejects.toThrow(/ensure/);
    await expect(roles(manager).ensure('shop-all', { name: 'All', permissions: ['shop:*'] })).rejects.toThrow(/ensure/);
    await expect(roles(manager).ensure('shop-users', { name: 'Users', permissions: ['users:manage'] })).rejects.toThrow(/ensure/);
    await expect(roles(manager).ensure('shop-loyal', { name: 'Loyal', permissions: ['loyalty:dashboard'] })).rejects.toThrow(/ensure/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses to declare — or claim — an administrator’s slug', async () => {
    const { manager, db } = managerWith();

    await expect(roles(manager).ensure('admin', { name: 'Administrator' })).rejects.toThrow(/"admin"/);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('declares the plugin’s own roles, with or without its own permissions', async () => {
    const { manager, db } = managerWith();

    await roles(manager).ensure('customer-plus', { name: 'Customer' });
    await roles(manager).ensure('shop-staff-2', { name: 'Staff', permissions: ['shop:own'] });

    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});
