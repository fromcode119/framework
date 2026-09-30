import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess, RequestContextUtils, RoleCatalog, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { UserPermissionChecker } from '@fromcode119/auth';
import { RoleManagementService } from '@api/services/role-management-service';
import { RoleScopeError } from '@api/services/role-scope-error';

/**
 * Each site has its own roles; the platform's roles stay on top.
 *
 * Before this every site's administrator edited the ONE shared `_system_roles`: it could give the
 * `customer` role any permission on every other customer's site, or delete a role another site's staff
 * sign in with. Now a site defines roles in `_system_site_roles` (row-level scoped), sees the platform's
 * roles read-only, and cannot shadow one; platform roles are defined only in platform scope, by a
 * platform admin.
 */

const PLATFORM = [
  { slug: 'admin', name: 'Admin', type: 'system', permissions: '["*"]' },
  { slug: 'customer', name: 'Customer', type: 'custom', permissions: '[]' },
];

/** A fake raw manager: platform roles, site roles for two sites, and a bound-site view of the latter. */
class FakeDb {
  siteRoles: any[] = [
    { slug: 'barista', name: 'Barista', permissions: '["shop:orders:read"]', tenant_id: 'acme' },
    { slug: 'barista', name: 'Barista', permissions: '["users:manage"]', tenant_id: 'globex' },
    // A clash the site could not create, left by the platform adding `customer` later: platform wins.
    { slug: 'customer', name: 'Customer+', permissions: '["users:manage"]', tenant_id: 'acme' },
  ];
  memberships: any[] = [];
  inserts: any[] = [];
  updates: any[] = [];
  deletes: any[] = [];
  upserts: any[] = [];
  scopes: string[] = [];

  async find(table: unknown) {
    if (table === '_system_roles') return PLATFORM;
    // Row-level security would already narrow this; the fake returns every site to prove the filter.
    if (table === '_system_site_roles') return this.siteRoles;
    if (table === '_system_tenant_memberships') return this.memberships;
    return [];
  }
  async findOne(table: unknown, where: any) {
    if (table === '_system_roles') return PLATFORM.find((role) => role.slug === where?.slug) ?? null;
    if (table === '_system_tenant_memberships') return this.memberships.find((row) => row.user_id === where.user_id && row.tenant_id === where.tenant_id) ?? null;
    return null;
  }
  async insert(table: unknown, row: any) { this.inserts.push({ table, row }); return row; }
  async update(table: unknown, where: any, row: any) { this.updates.push({ table, where, row }); return row; }
  async delete(table: unknown, where: any) { this.deletes.push({ table, where }); return true; }
  async upsert(table: unknown, row: any) { this.upserts.push({ table, row }); }
  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    this.scopes.push(tenantId);
    return fn();
  }
}

const inSite = <T>(tenantId: string, fn: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId } as any, fn);

afterEach(() => {
  TenantMode.reset();
  vi.restoreAllMocks();
});

describe('the role catalog', () => {
  it('is the platform roles plus the bound site\'s own — never another site\'s', async () => {
    const roles = await inSite('acme', () => new RoleCatalog(new FakeDb()).list('acme'));
    expect(roles.map((role) => `${role.scope.value}:${role.slug}`)).toEqual(['platform:admin', 'platform:customer', 'site:barista']);
    expect(roles.find((role) => role.slug === 'barista')?.permissions).toEqual(['shop:orders:read']);
  });

  it('lets the platform win a slug clash', async () => {
    const permissions = await inSite('acme', () => new RoleCatalog(new FakeDb()).permissionsFor(['customer'], 'acme'));
    expect(permissions).toEqual([]);
  });

  it('reads a site\'s roles inside that site\'s scope when none is bound — the login path', async () => {
    const db = new FakeDb();
    const permissions = await new RoleCatalog(db).permissionsFor(['barista'], 'globex');
    expect(permissions).toEqual(['users:manage']);
    expect(db.scopes).toEqual(['globex']);
  });

  it('is enforced per request: the permission checker resolves the request\'s own site', async () => {
    const checker = new UserPermissionChecker(new FakeDb() as any);
    await expect(inSite('acme', () => checker.hasPermissionForRoles(['barista'], 'shop:orders:read'))).resolves.toBe(true);
    await expect(inSite('acme', () => checker.hasPermissionForRoles(['barista'], 'users:manage'))).resolves.toBe(false);
    await expect(inSite('globex', () => checker.hasPermissionForRoles(['barista'], 'users:manage'))).resolves.toBe(true);
  });

  it('opens a site\'s console to a member holding one of that site\'s own roles', async () => {
    const db = new FakeDb();
    db.memberships = [{ user_id: '9', tenant_id: 'acme', roles: '["barista"]', state: 'active' }];
    vi.spyOn(TenantMembershipService.prototype as any, 'isPlatformAdmin').mockResolvedValue(false);
    const tenants = [{ id: 'acme', slug: 'acme', state: 'active' }];
    const find = db.find.bind(db);
    db.find = async (table: unknown) => (table === '_system_tenants' ? tenants : find(table));
    const administered = await new TenantMembershipService(db).listAdministeredByUser('9');
    expect(administered.map((access: any) => access.tenant.id)).toEqual(['acme']);
  });
});

describe('editing roles', () => {
  const siteEditor = { platformAdmin: false };

  it('writes a site\'s new role into that site\'s own table', async () => {
    const db = new FakeDb();
    vi.spyOn(PluginTenantAccess, 'enabledSlugsFor').mockReturnValue(new Set());
    await inSite('acme', () => new RoleManagementService(db).saveRole('cashier', { name: 'Cashier', permissions: ['shop:orders:read'] }, ['*'], siteEditor));
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({ table: '_system_site_roles', row: { slug: 'cashier', tenant_id: 'acme', permissions: ['shop:orders:read'] } });
    expect(db.upserts).toHaveLength(0);
  });

  it('refuses to redefine a platform role from inside a site', async () => {
    const db = new FakeDb();
    await expect(inSite('acme', () => new RoleManagementService(db).saveRole('customer', { name: 'Customer', permissions: ['users:manage'] }, ['*'], siteEditor)))
      .rejects.toBeInstanceOf(RoleScopeError);
    expect(db.upserts).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
  });

  it('refuses to delete a platform role from inside a site', async () => {
    const db = new FakeDb();
    await expect(inSite('acme', () => new RoleManagementService(db).deleteRole('customer', siteEditor))).rejects.toBeInstanceOf(RoleScopeError);
    expect(db.deletes).toHaveLength(0);
  });

  it('deletes only this site\'s own role, and takes it off this site\'s members', async () => {
    const db = new FakeDb();
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    db.memberships = [{ user_id: '9', tenant_id: 'acme', roles: '["barista","customer"]', state: 'active' }];
    await inSite('acme', () => new RoleManagementService(db).deleteRole('barista', siteEditor));
    expect(db.deletes[0]).toEqual({ table: '_system_site_roles', where: { slug: 'barista', tenant_id: 'acme' } });
    expect(db.updates.find((entry) => entry.table === '_system_tenant_memberships')?.row.roles).toBe('["customer"]');
  });

  it('refuses platform-role edits in platform scope from anyone but the platform admin', async () => {
    const db = new FakeDb();
    const roles = new RoleManagementService(db);
    await expect(roles.saveRole('editor', { name: 'Editor', permissions: [] }, ['*'], siteEditor)).rejects.toBeInstanceOf(RoleScopeError);
    await expect(roles.deleteRole('customer', siteEditor)).rejects.toBeInstanceOf(RoleScopeError);
    await roles.saveRole('editor', { name: 'Editor', permissions: [] }, ['*'], { platformAdmin: true });
    expect(db.upserts).toHaveLength(1);
  });

  it('tells the admin where each role is defined and whether it can be changed here', async () => {
    const db = new FakeDb();
    vi.spyOn(PluginTenantAccess, 'enabledSlugsFor').mockReturnValue(new Set());
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const listed = await inSite('acme', () => new RoleManagementService(db).getRoles(siteEditor));
    expect(listed.map((role: any) => [role.slug, role.scope, role.editable])).toEqual([
      ['admin', 'platform', false], ['customer', 'platform', false], ['barista', 'site', true],
    ]);
  });
});
