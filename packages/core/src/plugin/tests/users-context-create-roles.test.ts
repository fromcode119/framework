import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { UsersContextProxy } from '@core/plugin/context/users';

/**
 * What a PLUGIN may make when it creates an account.
 *
 * `context.users.create` takes the email, the roles, and an already-hashed password — a hash the
 * plugin knows. Without a gate, that is a plugin minting itself an administrator login. Pinned here:
 * the call needs a declared capability, a role reaching past the calling plugin is refused (never
 * downgraded), and the refusal happens before anything is written.
 */

const PLATFORM_ROLES = [
  { slug: 'admin', permissions: ['*'] },
  { slug: 'editor', permissions: ['content:read', 'content:write'] },
  { slug: 'user', permissions: [] },
  // An operator's custom role with full access under a name no deny-list would think of.
  { slug: 'helper', permissions: '["*"]' },
  // Roles plugins declare for the accounts they create — the calling plugin here is `shop`.
  { slug: 'shop-staff', permissions: ['shop:own'] },
  { slug: 'shop-boss', permissions: ['shop:*'] },
  { slug: 'loyalty-partner', permissions: ['loyalty:dashboard'] },
];

const SITE_ROLES = [
  { slug: 'manager', tenant_id: 'my-site', permissions: ['orders:manage'] },
  { slug: 'member', tenant_id: 'my-site', permissions: [] },
];

function managerWith(options: { rolesFail?: boolean } = {}) {
  const users: any[] = [];
  const memberships: any[] = [];
  const db = {
    find: vi.fn(async (table: string) => {
      if (table === SystemConstants.TABLE.ROLES) {
        if (options.rolesFail) throw new Error('connection reset');
        return PLATFORM_ROLES;
      }
      if (table === SystemConstants.TABLE.SITE_ROLES) return SITE_ROLES;
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) return memberships;
      return [];
    }),
    findOne: vi.fn(async (table: string, where: any) => {
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
        return memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
      }
      return users.find((u) => u.email === where.email) ?? null;
    }),
    insert: vi.fn(async (table: string, row: any) => {
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) { memberships.push(row); return row; }
      const created = { ...row, id: 700 + users.length };
      users.push(created);
      return created;
    }),
    update: vi.fn(),
    withTenant: vi.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
  };
  const audit = { logAction: vi.fn() };
  return { manager: { db, audit } as any, users, memberships, db, audit };
}

function security(granted: boolean) {
  return {
    hasCapability: vi.fn(() => granted),
    handleViolation: vi.fn((cap: string) => { throw new Error(`Security Violation: Missing "${cap}" capability.`); }),
    handleRateLimit: vi.fn(),
  };
}

const PLUGIN = { manifest: { slug: 'shop' } } as any;
const proxy = (manager: any, sec = security(true), plugin = PLUGIN) => UsersContextProxy.createUsersProxy(plugin, manager, sec as any);
const inSite = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
  RequestContextUtils.storage.run({ tenantId } as any, fn);
const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

afterEach(() => TenantMode.reset());

describe('context.users.create needs a declared capability', () => {
  it('refuses a plugin that has not declared database:write, and writes nothing', async () => {
    const { manager, db } = managerWith();
    const sec = security(false);

    await expect(proxy(manager, sec).create({ email: 'a@shop.test', password: 'h' })).rejects.toThrow(/database:write/);

    expect(sec.hasCapability).toHaveBeenCalledWith('database:write');
    expect(sec.handleViolation).toHaveBeenCalledWith('database:write');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('lets a plugin that declared it create a customer', async () => {
    const { manager, users } = managerWith();

    const created = await proxy(manager).create({ email: 'a@shop.test', password: 'h' });

    expect(created?.id).toBeDefined();
    expect(users[0]).toMatchObject({ email: 'a@shop.test', roles: ['customer'] });
  });
});

describe('context.users.create refuses a role that reaches past the calling plugin', () => {
  it.each([
    ['admin'], ['superadmin'], ['super_admin'], ['administrator'], ['owner'], ['platform-admin'],
  ])('refuses %s by name', async (role) => {
    const { manager, db } = managerWith();

    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: [role] })).rejects.toThrow(/refused role/);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses a spelling every reader would still read as admin', async () => {
    const { manager, db } = managerWith();

    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: [' Admin '] })).rejects.toThrow(/"admin"/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses the whole request when ONE of its roles is privileged — never a quiet downgrade', async () => {
    const { manager, db } = managerWith();

    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['customer', 'admin'] })).rejects.toThrow();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses a role by what it GRANTS, whatever it is called', async () => {
    const { manager, db } = managerWith();

    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['helper'] })).rejects.toThrow(/"helper"/);
    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['editor'] })).rejects.toThrow(/"editor"/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('allows a role carrying only the calling plugin’s own permissions — its own staff', async () => {
    const { manager, users } = managerWith();

    await proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['shop-staff'] });

    expect(users[0].roles).toEqual(['shop-staff']);
  });

  it('refuses another plugin’s permissioned role, and a wildcard even over its own namespace', async () => {
    const { manager, db } = managerWith();

    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['loyalty-partner'] })).rejects.toThrow(/"loyalty-partner"/);
    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['shop-boss'] })).rejects.toThrow(/"shop-boss"/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('gives a plugin whose slug is a framework namespace no namespace at all', async () => {
    // A plugin called `system` must not thereby own `system:backup:restore`.
    const { manager, db } = managerWith();
    const system = { manifest: { slug: 'system' } } as any;
    PLATFORM_ROLES.push({ slug: 'restorer', permissions: ['system:backup:restore'] });
    try {
      await expect(proxy(manager, security(true), system).create({ email: 'x@shop.test', password: 'h', roles: ['restorer'] })).rejects.toThrow(/"restorer"/);
    } finally {
      PLATFORM_ROLES.pop();
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses a SITE role that carries permissions on the site asking', async () => {
    multiTenant();
    const { manager, db, memberships } = managerWith();

    await expect(inSite('my-site', () => proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['manager'] }))).rejects.toThrow(/"manager"/);
    expect(db.insert).not.toHaveBeenCalled();
    expect(memberships).toEqual([]);
  });

  it('allows roles that grant nothing — defined empty, or not defined at all', async () => {
    multiTenant();
    const { manager, users, memberships } = managerWith();

    await inSite('my-site', () => proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['member', 'user', 'student'] }));

    expect(users[0].roles).toEqual(['member', 'user', 'student']);
    expect(memberships[0]).toMatchObject({ tenant_id: 'my-site' });
    expect(JSON.parse(memberships[0].roles)).toEqual(['member', 'user', 'student']);
  });

  it('does not attach an existing account to this site as an administrator either', async () => {
    // The idempotent branch grants a membership to someone else's login; it is the same escalation.
    multiTenant();
    const { manager, users, memberships } = managerWith();
    users.push({ id: 5, email: 'operator@platform.test', roles: ['customer'] });

    await expect(inSite('my-site', () => proxy(manager).create({ email: 'operator@platform.test', password: 'h', roles: ['admin'] }))).rejects.toThrow();
    expect(memberships).toEqual([]);
  });

  it('fails closed when the role catalog cannot be read', async () => {
    const { manager, db } = managerWith({ rolesFail: true });

    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['customer'] })).rejects.toThrow(/connection reset/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('records the refusal against the plugin', async () => {
    const { manager, audit } = managerWith();

    await expect(proxy(manager).create({ email: 'x@shop.test', password: 'h', roles: ['admin'] })).rejects.toThrow();
    expect(audit.logAction).toHaveBeenCalledWith('shop', 'Account Creation', 'roles', 'denied');
  });
});
