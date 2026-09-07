import { describe, it, expect } from 'vitest';
import { TenantMembershipService } from '@core/tenant/tenant-membership-service';

/**
 * Per-site roles are the point of a membership: the same account is a customer on one site and an
 * administrator on another. Before this, every guard read the account's GLOBAL roles, so the membership
 * roles were stored and never consulted — one answer everywhere.
 */
class FakeDb {
  constructor(private readonly users: any[], private readonly memberships: any[]) {}

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
