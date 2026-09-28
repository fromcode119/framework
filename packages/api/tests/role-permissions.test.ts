import { afterEach, describe, expect, it, vi } from 'vitest';
import { Schema } from '@fromcode119/database';
import { PluginState, PluginTenantAccess, RequestContextUtils, TenantMode } from '@fromcode119/core';
import { CollectionAccessPolicyService } from '@api/services/collection-access-policy-service';
import { PermissionCatalogService } from '@api/services/permission-catalog-service';
import { RoleManagementService } from '@api/services/role-management-service';
import { RoleGrantError } from '@api/services/role-grant-error';

/**
 * Roles are what decide what someone can do in the console. Three things have to agree for a role to
 * mean anything: the list the role editor offers, the collections API that enforces it, and what the
 * role list says a role holds.
 */

const ROLE_PERMISSIONS: Record<string, string[]> = {
  clerk: ['shop:orders:read', 'shop:orders:update'],
  manager: ['shop:*'],
  staff: ['appointments:own'],
};

const orders = { slug: 'shop_orders', shortSlug: 'orders', pluginSlug: 'shop', fields: [] } as any;
const audit = { slug: 'shop_audit', shortSlug: 'audit', pluginSlug: 'shop', fields: [], api: { update: false, delete: false } } as any;
const users = { slug: 'users', system: true, fields: [] } as any;

const request = (roles: string[]) => ({ user: { id: 1, roles } });

describe('collection access granted by a role', () => {
  CollectionAccessPolicyService.setPermissionResolver(async (roles) => roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []));
  const policy = new CollectionAccessPolicyService();

  it('lets a role read and update exactly the collection it was given', async () => {
    const req = request(['clerk']);
    await expect(policy.resolveReadConstraints(orders, req)).resolves.toEqual({});
    await expect(policy.ensureUpdateAllowed(orders, req)).resolves.toBeUndefined();
    await expect(policy.ensureDeleteAllowed(orders, req)).rejects.toMatchObject({ statusCode: 403 });
    await expect(policy.ensureCreateAllowed(orders, req)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('covers every collection of a plugin with its wildcard', async () => {
    await expect(policy.ensureDeleteAllowed(orders, request(['manager']))).resolves.toBeUndefined();
  });

  it('still refuses an operation the collection turns off, whatever the role holds', async () => {
    await expect(policy.ensureDeleteAllowed(audit, request(['manager']))).rejects.toMatchObject({ statusCode: 405 });
  });

  it('never grants a system collection through a plugin permission', async () => {
    await expect(policy.ensureUpdateAllowed(users, request(['manager']))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses a role that holds nothing for the collection', async () => {
    await expect(policy.ensureUpdateAllowed(orders, request(['staff']))).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('the permission catalog', () => {
  afterEach(() => {
    TenantMode.reset();
    vi.restoreAllMocks();
  });

  const plugin = (slug: string, menu: any[] = []) => ({
    state: PluginState.ACTIVE,
    manifest: { slug, name: slug.toUpperCase(), admin: { menu } },
  });
  const manager = {
    getPlugins: () => [
      plugin('shop'),
      plugin('appointments', [{ label: 'My schedule', path: '/appointments/me', permission: 'appointments:own' }]),
      { state: PluginState.DISABLED, manifest: { slug: 'off' } },
    ],
    getCollections: () => [orders, audit, users, { slug: 'off_things', shortSlug: 'things', pluginSlug: 'off', fields: [] }],
  } as any;

  it('offers the framework permissions, then each active plugin with its screens and collection operations', () => {
    const groups = new PermissionCatalogService(manager).list();
    expect(groups.map((group) => group.key)).toEqual(['framework', 'appointments', 'shop']);
    expect(groups[0].permissions.map((p) => p.name)).toContain('roles:manage');

    const shop = groups.find((group) => group.key === 'shop')!;
    expect(shop.all).toBe('shop:*');
    expect(shop.permissions.map((p) => p.name)).toEqual(['shop:manage']);
    expect(shop.collections.find((c) => c.key === 'orders')!.actions).toEqual({
      read: 'shop:orders:read', create: 'shop:orders:create', update: 'shop:orders:update', delete: 'shop:orders:delete',
    });
    // An operation the collection turns off is not offered.
    expect(Object.keys(shop.collections.find((c) => c.key === 'audit')!.actions)).toEqual(['read', 'create']);

    const appointments = groups.find((group) => group.key === 'appointments')!;
    expect(appointments.permissions.map((p) => [p.name, p.label])).toContainEqual(['appointments:own', 'My schedule']);
  });

  it('does not offer sandbox capabilities as permissions', () => {
    const names = new PermissionCatalogService(manager).names();
    expect(names.has('database:raw')).toBe(false);
    expect(names.has('network')).toBe(false);
  });

  it('on a site, lists only the plugins that site runs', () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    vi.spyOn(PluginTenantAccess, 'enabledSlugsFor').mockReturnValue(new Set(['shop']));
    const groups = RequestContextUtils.storage.run({ tenantId: 'site-a' } as any, () => new PermissionCatalogService(manager).list());
    expect(groups.map((group) => group.key)).toEqual(['framework', 'shop']);
  });
});

describe('saving a role', () => {
  class FakeDb {
    upserts: any[] = [];
    constructor(private readonly existing: any) {}
    async findOne(table: unknown) { return table === Schema.systemRoles ? this.existing : null; }
    async upsert(_table: unknown, row: any) { this.upserts.push(row); }
  }

  it('refuses permissions the person saving it does not hold', async () => {
    const db = new FakeDb(null);
    const roles = new RoleManagementService(db as any);
    await expect(roles.saveRole('clerk', { name: 'Clerk', permissions: ['*'] }, ['roles:manage', 'shop:*']))
      .rejects.toBeInstanceOf(RoleGrantError);
    expect(db.upserts).toHaveLength(0);
  });

  it('allows what the editor holds, and keeps what the role already had', async () => {
    const db = new FakeDb({ slug: 'clerk', permissions: '["users:manage"]' });
    const roles = new RoleManagementService(db as any);
    await roles.saveRole('clerk', { name: 'Clerk', permissions: ['users:manage', 'shop:orders:read'] }, ['roles:manage', 'shop:*']);
    expect(db.upserts[0].permissions).toEqual(['users:manage', 'shop:orders:read']);
  });

  it('reports the permissions a role carries from the column the permission check enforces', () => {
    expect(RoleManagementService.permissionsOf({ permissions: '["appointments:own"]' })).toEqual(['appointments:own']);
    expect(RoleManagementService.permissionsOf({ permissions: ['*'] })).toEqual(['*']);
  });
});
