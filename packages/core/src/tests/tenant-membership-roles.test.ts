import { describe, it, expect } from 'vitest';
import { TenantMembershipService } from '@core/tenant/tenant-membership-service';

/**
 * Per-site roles are the point of a membership: the same account is a customer on one site and an
 * administrator on another. Before this, every guard read the account's GLOBAL roles, so the membership
 * roles were stored and never consulted — one answer everywhere.
 */
class FakeDb {
  constructor(
    private readonly users: any[],
    private readonly memberships: any[],
    private readonly tenants: any[] = [],
  ) {}

  async find(table: string, options: any = {}) {
    if (table.includes('memberships')) {
      const userId = options?.where?.user_id;
      return this.memberships.filter((m) => !userId || m.user_id === userId);
    }
    return this.tenants;
  }

  async findOne(table: string, where: any) {
    if (table.includes('memberships')) {
      return this.memberships.find(m => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
    }
    return this.users.find(u => String(u.id) === String(where.id)) ?? null;
  }
}

const service = () => new TenantMembershipService(new FakeDb(
  [
    { id: '10', is_platform_admin: false },
    { id: '11', is_platform_admin: true },
  ],
  [
    { user_id: '10', tenant_id: 'shop', roles: ['admin'], state: 'active' },
    { user_id: '10', tenant_id: 'blog', roles: ['customer'], state: 'active' },
    { user_id: '10', tenant_id: 'old', roles: ['admin'], state: 'suspended' },
  ],
));

describe('TenantMembershipService.rolesForTenant', () => {
  it('gives one account different roles on different sites', async () => {
    expect(await service().rolesForTenant('10', 'shop')).toEqual(['admin']);
    expect(await service().rolesForTenant('10', 'blog')).toEqual(['customer']);
  });

  it('leaves a platform admin on their global roles — their reach is the platform', async () => {
    expect(await service().rolesForTenant('11', 'shop')).toBeNull();
  });

  it('does not narrow an account that is not a member here', async () => {
    expect(await service().rolesForTenant('10', 'unknown')).toBeNull();
  });

  it('ignores a membership that is not active', async () => {
    expect(await service().rolesForTenant('10', 'old')).toBeNull();
  });

  it('answers null rather than guessing when either id is missing', async () => {
    expect(await service().rolesForTenant('', 'shop')).toBeNull();
    expect(await service().rolesForTenant('10', '')).toBeNull();
  });
});

/**
 * The console must offer only sites the account can actually administer.
 *
 * Administrator of one site and customer of another is the ordinary case, and listing the second in an
 * admin console is a dead end: there is nothing there the account may do. Its relationship with that
 * site is a storefront one.
 */
describe('TenantMembershipService — which sites the console offers', () => {
  const build = () => new TenantMembershipService(new FakeDb(
    [
      { id: '10', is_platform_admin: false },
      { id: '11', is_platform_admin: true },
    ],
    [
      { user_id: '10', tenant_id: 'google', roles: ['admin'], state: 'active' },
      { user_id: '10', tenant_id: 'facebook', roles: ['customer'], state: 'active' },
    ],
    [
      { id: 'google', slug: 'google', primary_host: 'google.test', state: 'active', kind: 'site' },
      { id: 'facebook', slug: 'facebook', primary_host: 'facebook.test', state: 'active', kind: 'site' },
    ],
  ));

  it('offers the site it administers and not the one it is a customer of', async () => {
    const listed = await build().listAdministeredByUser('10');
    expect(listed.map((entry) => entry.tenant.id)).toEqual(['google']);
  });

  it('still admits it at the door, because it administers something', async () => {
    expect(await build().administersAnyTenant('10')).toBe(true);
  });

  it('refuses an account that administers nothing', async () => {
    const service = new TenantMembershipService(new FakeDb(
      [{ id: '12', is_platform_admin: false }],
      [{ user_id: '12', tenant_id: 'facebook', roles: ['customer'], state: 'active' }],
      [{ id: 'facebook', slug: 'facebook', primary_host: 'facebook.test', state: 'active', kind: 'site' }],
    ));
    expect(await service.administersAnyTenant('12')).toBe(false);
    expect(await service.listAdministeredByUser('12')).toEqual([]);
  });
});
