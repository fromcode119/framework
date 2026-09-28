import { describe, it, expect } from 'vitest';
import { RolePermissionSelection } from '@/app/users/roles/services/role-permission-selection';

const group = {
  key: 'shop', label: 'Shop', all: 'shop:*',
  permissions: [{ name: 'shop:manage', label: 'Shop screens', description: '' }],
  collections: [{ key: 'orders', label: 'Orders', actions: { read: 'shop:orders:read', update: 'shop:orders:update' } }],
};

describe('RolePermissionSelection', () => {
  it('a wildcard includes what it covers, without listing it', () => {
    expect(RolePermissionSelection.isIncluded(['shop:*'], 'shop:orders:read')).toBe(true);
    expect(RolePermissionSelection.isOn(['shop:*'], 'shop:orders:read')).toBe(true);
    expect(RolePermissionSelection.isIncluded(['shop:orders:read'], 'shop:orders:read')).toBe(false);
  });

  it('ticks and unticks a whole collection row', () => {
    const on = RolePermissionSelection.setAll(['x'], ['shop:orders:read', 'shop:orders:update'], true);
    expect(on).toEqual(['x', 'shop:orders:read', 'shop:orders:update']);
    expect(RolePermissionSelection.setAll(on, ['shop:orders:read', 'shop:orders:update'], false)).toEqual(['x']);
  });

  it('counts a group by what the role holds in it, wildcards included', () => {
    expect(RolePermissionSelection.countIn(['shop:orders:read'], group)).toBe(1);
    expect(RolePermissionSelection.countIn(['shop:*'], group)).toBe(4);
  });

  it('names what the role lists that nothing on this site offers', () => {
    expect(RolePermissionSelection.unrecognised(['content', 'shop:manage'], [group])).toEqual(['content']);
  });
});
