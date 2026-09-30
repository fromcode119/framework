import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemConstants, TenantMode } from '@fromcode119/core';
import { AuthControllerPolicy } from '@api/controllers/auth/auth-controller-policy';

/**
 * An account that signs up on a storefront — with a password or with a provider — becomes a customer of
 * that site. It used to belong to no site, so its session entered no site and the storefront refused it
 * on the very next request.
 */
class MembershipTable {
  readonly rows: any[] = [];
  constructor(seed: any[] = []) { this.rows.push(...seed); }
  async findOne(table: string, where: any) {
    if (table !== SystemConstants.TABLE.TENANT_MEMBERSHIPS) return null;
    return this.rows.find((row) => row.user_id === where.user_id && row.tenant_id === where.tenant_id) ?? null;
  }
  async find() { return []; }
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
  async insert(table: string, row: any) { if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) this.rows.push(row); return row; }
  async update(table: string, where: any, patch: any) {
    const row = this.rows.find((r) => r.user_id === where.user_id && r.tenant_id === where.tenant_id);
    Object.assign(row, patch);
    return row;
  }
}

class JoinProbe extends AuthControllerPolicy {
  join(req: any, userId: string) { return this.joinStorefrontSite(req, userId); }
  belongs(req: any, userId: string) { return this.belongsToStorefrontSite(req, userId); }
}

const probe = (db: MembershipTable) => new JoinProbe({ db, hooks: { call: vi.fn(), emit: vi.fn(), on: vi.fn() } } as any, {} as any);
const storefront = { tenantSurface: 'storefront', tenant: { id: 'shop' } };

describe('signing up on a storefront', () => {
  beforeEach(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
  afterEach(() => TenantMode.reset());

  it("makes the account a customer of the storefront's site", async () => {
    const db = new MembershipTable();
    await probe(db).join(storefront, '7');
    expect(db.rows).toEqual([expect.objectContaining({ user_id: '7', tenant_id: 'shop', roles: '["customer"]', state: 'active' })]);
  });

  it("never rewrites an existing membership — a site's administrator keeps their roles", async () => {
    const db = new MembershipTable([{ user_id: '1', tenant_id: 'shop', roles: '["admin"]', state: 'active' }]);
    await probe(db).join(storefront, '1');
    expect(db.rows).toEqual([expect.objectContaining({ roles: '["admin"]' })]);
  });

  it('does not re-activate a customer the site suspended', async () => {
    const db = new MembershipTable([{ user_id: '9', tenant_id: 'shop', roles: '["customer"]', state: 'suspended' }]);
    await probe(db).join(storefront, '9');
    expect(db.rows).toEqual([expect.objectContaining({ state: 'suspended' })]);
  });

  it('knows who already belongs to the site — in any membership state — and that off a storefront there is nothing to join', async () => {
    const db = new MembershipTable([{ user_id: '9', tenant_id: 'shop', roles: '["customer"]', state: 'suspended' }]);
    expect(await probe(db).belongs(storefront, '9')).toBe(true);
    expect(await probe(db).belongs(storefront, '7')).toBe(false);
    expect(await probe(db).belongs({ tenantSurface: 'admin', tenant: { id: 'shop' } }, '7')).toBe(true);
  });

  it('joins nothing off a storefront (the console, the platform host)', async () => {
    const db = new MembershipTable();
    await probe(db).join({ tenantSurface: 'admin', tenant: { id: 'shop' } }, '7');
    await probe(db).join({}, '7');
    expect(db.rows).toEqual([]);
  });
});
