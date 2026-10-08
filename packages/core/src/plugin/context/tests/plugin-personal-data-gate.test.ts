import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PeopleContextProxy } from '@core/plugin/context/people';

/**
 * Erasure tombstones an account, ends its sessions and drops its roles — what a data-subject request
 * needs, and a lockout when any plugin can aim it at the administrator. It needed no capability.
 * Erasure now needs `database:write`, export `database:read`, and an erasure is refused for an
 * administrator or anyone holding a role the calling plugin could not grant.
 */

const ROLES = [{ slug: 'admin', permissions: ['*'] }, { slug: 'customer', permissions: [] }];

function setup(options: { users?: any[]; people?: any[]; memberships?: any[]; granted?: boolean } = {}) {
  const users = options.users ?? [];
  const people = options.people ?? [];
  const memberships = options.memberships ?? [];
  const db = {
    find: vi.fn(async (table: string, query: any) => {
      if (table === SystemConstants.TABLE.ROLES) return ROLES;
      if (table === SystemConstants.TABLE.PEOPLE) return people.filter((p) => p.email === query?.where?.email);
      return [];
    }),
    findOne: vi.fn(async (table: string, where: any) => {
      if (table === SystemConstants.TABLE.USERS) {
        return users.find((u) => (where.id !== undefined ? String(u.id) === String(where.id) : u.email === where.email)) ?? null;
      }
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
        return memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
      }
      return null;
    }),
    insert: vi.fn(), update: vi.fn(), delete: vi.fn(),
    withTenant: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
  };
  const audit = { logAction: vi.fn() };
  const security = {
    hasCapability: vi.fn(() => options.granted ?? true),
    handleViolation: vi.fn((cap: string) => { throw new Error(`Security Violation: Missing "${cap}" capability.`); }),
    handleRateLimit: vi.fn(),
  };
  const people$ = PeopleContextProxy.createPeopleProxy({ manifest: { slug: 'privacy' } } as any, { db, audit } as any, {}, security as any);
  return { personalData: (people$ as any).personalData, db, audit, security };
}

afterEach(() => TenantMode.reset());

describe('context.people.personalData erasure', () => {
  it('refuses to erase an administrator, writing nothing', async () => {
    const { personalData, db, audit } = setup({ users: [{ id: 1, email: 'owner@site.test', roles: ['admin'] }] });

    await expect(personalData.eraseAll({ userId: 1 })).rejects.toThrow(/refused role/);
    await expect(personalData.eraseDataset('account', { email: 'owner@site.test' }, 'anonymise')).rejects.toThrow(/refused role/);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(audit.logAction).toHaveBeenCalledWith('privacy', 'Personal Data Erasure', 'users', 'denied');
  });

  it('refuses a platform administrator', async () => {
    const { personalData } = setup({ users: [{ id: 2, email: 'op@platform.test', roles: ['customer'], is_platform_admin: true }] });

    await expect(personalData.eraseSource('shop:orders', { userId: 2 }, 'delete')).rejects.toThrow(/platform administrator/);
  });

  it('refuses an administrator reached through their person row', async () => {
    const { personalData } = setup({
      users: [{ id: 1, email: 'owner@site.test', roles: ['admin'] }],
      people: [{ id: 9, email: 'alias@site.test', user_id: 1 }],
    });

    await expect(personalData.eraseAll({ email: 'alias@site.test' })).rejects.toThrow(/refused role/);
  });

  it('refuses someone who is an administrator on THIS site', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const { personalData } = setup({
      users: [{ id: 3, email: 'owner@site.test', roles: ['customer'] }],
      memberships: [{ user_id: '3', tenant_id: 'my-site', roles: ['admin'], state: 'active' }],
    });

    await expect(RequestContextUtils.storage.run({ tenantId: 'my-site' } as any, () => personalData.eraseAll({ userId: 3 }))).rejects.toThrow(/"admin"/);
  });

  it('needs database:write to erase and database:read to export', async () => {
    const { personalData, security } = setup({ granted: false, users: [{ id: 4, email: 'c@site.test', roles: ['customer'] }] });

    await expect(personalData.eraseAll({ userId: 4 })).rejects.toThrow(/database:write/);
    await expect(personalData.exportDataset('account', { userId: 4 })).rejects.toThrow(/database:read/);
    expect(security.handleViolation).toHaveBeenCalledWith('database:write');
  });

  it('lets a request for an ordinary customer through', async () => {
    const { personalData } = setup({ users: [{ id: 4, email: 'c@site.test', roles: ['customer'] }] });

    await expect(personalData.eraseDataset('sessions', { userId: 4 }, 'delete')).resolves.toBeDefined();
  });
});
