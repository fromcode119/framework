import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { UsersContextProxy } from '@core/plugin/context/users';

/**
 * What `context.users.*` answers for a plugin serving one site.
 *
 * `users` is a single GLOBAL table with no row-level policy, so these methods are the only thing
 * standing between a plugin and every account on the platform. They are also the methods plugins use
 * to answer "who are the admins", which is how an order email finds its recipients — so a wrong
 * answer here is either a disclosure or a silently undelivered notification.
 *
 * Three distinct failures are pinned below, and the third is the one that hides: an answer that comes
 * back EMPTY rather than wrong. A recipient list of zero drops the email with no error anywhere.
 */

const PLATFORM_USERS = [
  // Newest first, as the table is ordered. Ids 90+ belong to other sites and crowd the page.
  { id: 99, email: 'newest@other.test', roles: ['admin'], firstName: 'New', lastName: 'Other' },
  { id: 98, email: 'also@other.test', roles: ['admin'], firstName: 'Also', lastName: 'Other' },
  { id: 3, email: 'owner@mysite.test', roles: ['admin'], firstName: 'Site', lastName: 'Owner' },
  { id: 4, email: 'shopper@mysite.test', roles: ['customer'], firstName: 'Shop', lastName: 'Per' },
  // A platform operator imported into this site AS A CUSTOMER — global column says admin, the
  // site's own membership says customer. The repo has a note about exactly this shape.
  { id: 5, email: 'operator@platform.test', roles: ['admin'], firstName: 'Plat', lastName: 'Op' },
];

/** Memberships of `my-site`: the owner is an admin here, the shopper and the operator are not. */
const MEMBERSHIPS = [
  { user_id: '3', tenant_id: 'my-site', roles: ['admin'], state: 'active' },
  { user_id: '4', tenant_id: 'my-site', roles: ['customer'], state: 'active' },
  { user_id: '5', tenant_id: 'my-site', roles: ['customer'], state: 'active' },
];

function managerWith(options: { limit?: number } = {}) {
  const calls: any[] = [];
  const db = {
    find: vi.fn(async (table: string, query: any) => {
      calls.push({ table, query });
      if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
        return MEMBERSHIPS.filter((m) => m.tenant_id === query?.where?.tenant_id);
      }
      if (table === SystemConstants.TABLE.USERS) {
        const ids: number[] | undefined = query?.where?.id?.in;
        const rows = ids ? PLATFORM_USERS.filter((u) => ids.includes(u.id)) : PLATFORM_USERS;
        return rows.slice(0, query?.limit ?? options.limit ?? 500);
      }
      return [];
    }),
    findOne: vi.fn(async (table: string, where: any) => {
      if (table !== SystemConstants.TABLE.USERS) return null;
      return PLATFORM_USERS.find((u) => (where.id !== undefined ? u.id === Number(where.id) : u.email === where.email)) ?? null;
    }),
  };
  return { manager: { db } as any, calls };
}

const inSite = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
  RequestContextUtils.storage.run({ tenantId } as any, fn);

const proxy = (manager: any) => UsersContextProxy.createUsersProxy({} as any, manager);

const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

afterEach(() => TenantMode.reset());

describe('context.users inside one site', () => {
  it('finds only this site’s admins, by the SITE’s roles and not the global column', async () => {
    multiTenant();
    const { manager } = managerWith();

    const admins = await inSite('my-site', () => proxy(manager).findAdmins());

    // The owner, and nobody else. Not the two newer admins of other sites, and NOT the platform
    // operator — this site made them a customer, and this site's answer is the one that counts.
    expect(admins.map((a: any) => a.email)).toEqual(['owner@mysite.test']);
  });

  it('applies the limit INSIDE the site, so a site’s own admin is never crowded out', async () => {
    // The failure this pins is silence, not disclosure. Paging the newest 2 rows platform-wide and
    // filtering afterwards returns [], an order email with no recipients, and no error anywhere.
    multiTenant();
    const { manager, calls } = managerWith();

    const admins = await inSite('my-site', () => proxy(manager).findAdmins({ limit: 2 }));

    expect(admins.map((a: any) => a.email)).toEqual(['owner@mysite.test']);
    const userQuery = calls.find((c) => c.table === SystemConstants.TABLE.USERS)?.query;
    expect(userQuery?.where?.id?.in).toEqual(expect.arrayContaining([3, 4, 5]));
  });

  it('findByRole answers from the site’s membership roles', async () => {
    multiTenant();
    const { manager } = managerWith();

    const customers = await inSite('my-site', () => proxy(manager).findByRole('customer'));

    // The operator counts as a customer HERE, which is what this site decided.
    expect(customers.map((c: any) => c.email).sort()).toEqual(['operator@platform.test', 'shopper@mysite.test']);
  });

  it('refuses to resolve an id belonging to another site', async () => {
    multiTenant();
    const { manager } = managerWith();

    expect(await inSite('my-site', () => proxy(manager).findById(99))).toBeNull();
    expect(await inSite('my-site', () => proxy(manager).findById(3))).toMatchObject({ email: 'owner@mysite.test' });
  });

  it('refuses to resolve an email belonging to another site — the enumeration oracle', async () => {
    // A hit would tell the caller the address is registered somewhere on the platform, and hand back
    // the holder's name. Callers then WRITE what they resolved into this site's own rows.
    multiTenant();
    const { manager } = managerWith();

    expect(await inSite('my-site', () => proxy(manager).findByEmail('newest@other.test'))).toBeNull();
    expect(await inSite('my-site', () => proxy(manager).findByEmail('owner@mysite.test'))).toMatchObject({ id: 3 });
  });

  it('lists only this site’s people', async () => {
    multiTenant();
    const { manager } = managerWith();

    const listed = await inSite('my-site', () => proxy(manager).list({ limit: 100 }));

    expect(listed.map((u: any) => u.id).sort()).toEqual([3, 4, 5]);
  });

  it('answers for everyone when no site is bound — a background job has no site to narrow to', async () => {
    multiTenant();
    const { manager } = managerWith();

    expect((await proxy(manager).findAdmins()).length).toBeGreaterThan(1);
    expect(await proxy(manager).findById(99)).toMatchObject({ email: 'newest@other.test' });
  });

  it('leaves a SINGLE-TENANT deployment alone', async () => {
    const { manager } = managerWith();

    const admins = await inSite('my-site', () => proxy(manager).findAdmins());

    expect(admins.length).toBeGreaterThan(1);
  });
});

/**
 * `create` had to change with the rest of this file, and it is the one that would have broken on
 * merge rather than merely leaked.
 *
 * It writes into the GLOBAL `users` table. Once every other method here answers by membership, a row
 * with no membership is invisible to them — so a plugin could create a person and fail to find them
 * one line later. The idempotent branch is the sharper edge: its lookup is by email across the whole
 * platform, so it can hand back an account that belongs to a DIFFERENT site.
 */
describe('context.users.create joins the site that asked', () => {
  function writableManager(seed: any[] = []) {
    const users = [...seed];
    const memberships: any[] = [];
    const db = {
      find: vi.fn(async (table: string, query: any) => {
        if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
          return memberships.filter((m) => !query?.where?.tenant_id || m.tenant_id === query.where.tenant_id);
        }
        const ids: number[] | undefined = query?.where?.id?.in;
        return ids ? users.filter((u) => ids.includes(Number(u.id))) : users;
      }),
      findOne: vi.fn(async (table: string, where: any) => {
        if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
          return memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id) ?? null;
        }
        return users.find((u) => (where.id !== undefined ? Number(u.id) === Number(where.id) : u.email === where.email)) ?? null;
      }),
      insert: vi.fn(async (table: string, row: any) => {
        if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) { memberships.push(row); return row; }
        const created = { ...row, id: 500 + users.length };
        users.push(created);
        return created;
      }),
      update: vi.fn(async (table: string, where: any, patch: any) => {
        const row = memberships.find((m) => m.user_id === where.user_id && m.tenant_id === where.tenant_id);
        if (row) Object.assign(row, patch);
        return row;
      }),
    };
    return { manager: { db } as any, memberships, db };
  }

  const newUser = { email: 'partner@mysite.test', password: 'hashed' };

  it('gives a newly created person a membership of this site', async () => {
    multiTenant();
    const { manager, memberships } = writableManager();

    const created = await inSite('my-site', () => proxy(manager).create(newUser));

    expect(created?.id).toBeDefined();
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ user_id: String(created!.id), tenant_id: 'my-site', state: 'active' });
  });

  it('so the created person is findable immediately afterwards', async () => {
    // The regression this prevents: create succeeds, the very next lookup returns null.
    multiTenant();
    const { manager } = writableManager();

    const found = await inSite('my-site', async () => {
      const created = await proxy(manager).create(newUser);
      return proxy(manager).findById(created!.id);
    });

    expect(found).toMatchObject({ email: 'partner@mysite.test' });
  });

  it('attaches an account that already exists on ANOTHER site instead of linking to it blindly', async () => {
    multiTenant();
    const { manager, memberships } = writableManager([{ id: 77, email: 'partner@mysite.test', roles: ['customer'] }]);

    const created = await inSite('my-site', () => proxy(manager).create(newUser));

    expect(created?.id).toBe(77);
    expect(memberships).toEqual([expect.objectContaining({ user_id: '77', tenant_id: 'my-site' })]);
  });

  it('never rewrites a membership that already exists', async () => {
    // `grant` REPLACES roles and this call defaults to `customer`; a second create must not demote
    // the site's own administrator.
    multiTenant();
    const { manager, memberships, db } = writableManager([{ id: 88, email: 'partner@mysite.test' }]);
    memberships.push({ user_id: '88', tenant_id: 'my-site', roles: ['admin'], state: 'active' });

    await inSite('my-site', () => proxy(manager).create(newUser));

    expect(memberships[0].roles).toEqual(['admin']);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('writes no membership on a single-site deployment', async () => {
    const { manager, memberships } = writableManager();

    await inSite('my-site', () => proxy(manager).create(newUser));

    expect(memberships).toEqual([]);
  });

  it('writes no membership when no site is bound', async () => {
    multiTenant();
    const { manager, memberships } = writableManager();

    await proxy(manager).create(newUser);

    expect(memberships).toEqual([]);
  });
});
