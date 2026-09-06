import { describe, expect, it, vi } from 'vitest';
import { TenantMembershipService } from '@core/tenant/tenant-membership-service';

const TENANTS = [
  { id: 't1', slug: 'acme', primary_host: 'acme.test', host_aliases: [], state: 'active' },
  { id: 't2', slug: 'globex', primary_host: 'globex.test', host_aliases: [], state: 'active' },
  { id: 't3', slug: 'old', primary_host: 'old.test', host_aliases: [], state: 'suspended' },
];

/**
 * `users` and the membership table are read through the RAW manager, so rows carry snake_case
 * column names — the fixtures mirror that deliberately.
 */
function fakeDb(options: {
  memberships?: Array<Record<string, unknown>>;
  platformAdmin?: boolean;
} = {}) {
  const memberships = options.memberships ?? [];
  return {
    find: vi.fn(async (table: string) => (
      table === '_system_tenants' ? TENANTS.map((t) => ({ ...t })) : memberships.map((m) => ({ ...m }))
    )),
    findOne: vi.fn(async (table: string, where: any) => {
      if (table === 'users') return { id: where.id, is_platform_admin: options.platformAdmin === true };
      return memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
    }),
    insert: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => true),
  } as any;
}

describe('TenantMembershipService', () => {
  it('lists only the tenants the account is an ACTIVE member of', async () => {
    const service = new TenantMembershipService(fakeDb({
      memberships: [{ user_id: '7', tenant_id: 't1', state: 'active' }],
    }));
    expect((await service.listForUser('7')).map((t) => t.id)).toEqual(['t1']);
  });

  it('lists both tenants for an account granted two — one account, two memberships', async () => {
    const service = new TenantMembershipService(fakeDb({
      memberships: [
        { user_id: '7', tenant_id: 't1', state: 'active' },
        { user_id: '7', tenant_id: 't2', state: 'active' },
      ],
    }));
    expect((await service.listForUser('7')).map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('excludes a SUSPENDED membership — revoking access must actually revoke it', async () => {
    const service = new TenantMembershipService(fakeDb({
      memberships: [{ user_id: '7', tenant_id: 't1', state: 'suspended' }],
    }));
    expect(await service.listForUser('7')).toEqual([]);
    expect(await service.hasAccess('7', 't1')).toBe(false);
  });

  it('excludes a suspended TENANT even when the membership is active', async () => {
    const service = new TenantMembershipService(fakeDb({
      memberships: [{ user_id: '7', tenant_id: 't3', state: 'active' }],
    }));
    expect(await service.listForUser('7')).toEqual([]);
  });

  it('gives an account with no memberships nothing', async () => {
    const service = new TenantMembershipService(fakeDb({ memberships: [] }));
    expect(await service.listForUser('7')).toEqual([]);
    expect(await service.hasAccess('7', 't1')).toBe(false);
  });

  it('gives a PLATFORM ADMIN every active tenant, without any membership row', async () => {
    const service = new TenantMembershipService(fakeDb({ memberships: [], platformAdmin: true }));
    expect((await service.listForUser('1')).map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(await service.hasAccess('1', 't2')).toBe(true);
  });

  it('marks a platform admin\'s tenants as PLATFORM access, not membership', async () => {
    const service = new TenantMembershipService(fakeDb({ memberships: [], platformAdmin: true }));
    const access = await service.listForUser('1');
    expect(access.every((entry) => entry.viaPlatformRole)).toBe(true);
  });

  it('a platform admin enters a tenant it is a MEMBER of as a member, not via the role', async () => {
    // The distinction the operator reads on screen: only the tenants membership does not explain
    // are marked, so the badge means "someone else's customer" and nothing weaker.
    const service = new TenantMembershipService(fakeDb({
      memberships: [{ user_id: '1', tenant_id: 't1', state: 'active' }],
      platformAdmin: true,
    }));
    const access = await service.listForUser('1');
    expect(access.find((entry) => entry.id === 't1')?.viaPlatformRole).toBe(false);
    expect(access.find((entry) => entry.id === 't2')?.viaPlatformRole).toBe(true);
  });

  it('marks an ordinary member\'s tenants as membership, never platform', async () => {
    const service = new TenantMembershipService(fakeDb({
      memberships: [{ user_id: '7', tenant_id: 't1', state: 'active' }],
    }));
    expect((await service.listForUser('7')).every((entry) => entry.viaPlatformRole)).toBe(false);
  });

  it('refuses empty ids rather than matching everything', async () => {
    const service = new TenantMembershipService(fakeDb({ memberships: [] }));
    expect(await service.listForUser('')).toEqual([]);
    expect(await service.hasAccess('', 't1')).toBe(false);
    expect(await service.hasAccess('7', '')).toBe(false);
  });

  it('revoke removes ONE membership, addressed by both sides of the pair', async () => {
    const db = fakeDb({ memberships: [{ user_id: '7', tenant_id: 't1', state: 'active' }] });
    await new TenantMembershipService(db).revoke('7', 't1');
    expect(db.delete).toHaveBeenCalledWith('_system_tenant_memberships', { user_id: '7', tenant_id: 't1' });
  });
});
