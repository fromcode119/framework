import { describe, expect, it } from 'vitest';
import { TenantMembership } from '@core/tenant/tenant-membership';

describe('TenantMembership', () => {
  it('hydrates from a raw row (snake_case — the raw manager does not denormalize)', () => {
    const membership = TenantMembership.from({
      user_id: '7', tenant_id: 't1', roles: '["admin"]', state: 'active',
    });
    expect(membership.userId).toBe('7');
    expect(membership.tenantId).toBe('t1');
    expect(membership.roles).toEqual(['admin']);
    expect(membership.isActive).toBe(true);
  });

  it('accepts roles already stored as an array', () => {
    expect(TenantMembership.from({ user_id: '7', tenant_id: 't1', roles: ['editor'], state: 'active' }).roles)
      .toEqual(['editor']);
  });

  it('treats malformed roles as NO roles, never as all roles', () => {
    expect(TenantMembership.from({ user_id: '7', tenant_id: 't1', roles: 'not json', state: 'active' }).roles)
      .toEqual([]);
    expect(TenantMembership.from({ user_id: '7', tenant_id: 't1', roles: '{"a":1}', state: 'active' }).roles)
      .toEqual([]);
  });

  it('is inactive in any state other than active', () => {
    expect(TenantMembership.from({ user_id: '7', tenant_id: 't1', state: 'suspended' }).isActive).toBe(false);
    expect(TenantMembership.from({ user_id: '7', tenant_id: 't1' }).isActive).toBe(false);
  });

  it('refuses a row missing either side of the pair', () => {
    expect(() => TenantMembership.from({ tenant_id: 't1', state: 'active' })).toThrow(/user/i);
    expect(() => TenantMembership.from({ user_id: '7', state: 'active' })).toThrow(/tenant/i);
  });
});
