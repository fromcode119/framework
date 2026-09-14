import { describe, expect, it, vi } from 'vitest';
import { AuthManager } from '@fromcode119/auth';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * The check and the insert must be ONE indivisible step, whatever the driver.
 *
 * This used to assert the Postgres statements the controller issued itself, which meant the test
 * passed while SQLite and MySQL took an unguarded check-then-insert. It now asserts the contract: the
 * work happens inside the database layer's exclusive section, and the driver decides how that is
 * serialised.
 */
describe('initial administrator setup', () => {
  const dbFixture = (userCount: number) => {
    const calls: string[] = [];
    return {
      calls,
      db: {
        withExclusiveLock: vi.fn(async (name: string, operation: () => Promise<unknown>) => {
          calls.push(`lock:${name}`);
          return operation();
        }),
        count: vi.fn(async () => { calls.push('count'); return userCount; }),
        insert: vi.fn(async () => { calls.push('insert'); return { id: 1, email: 'admin@example.test' }; }),
      } as any,
    };
  };

  it('creates the first administrator inside the exclusive section, never outside it', async () => {
    const { db, calls } = dbFixture(0);
    const controller = new AuthControllerLifecycle({ db } as any, new AuthManager('test-secret'));

    const user = await (controller as any).createInitialUser('admin@example.test', 'hash');

    expect(user.id).toBe(1);
    expect(calls).toEqual(['lock:fromcode.initial-admin-setup', 'count', 'insert']);
  });

  /**
   * The founding account is the platform OWNER, and without this the install locks itself out.
   *
   * `roles: ['admin']` is a TENANT administrator — `admin` is deliberately not platform admin, so a
   * site's own admin cannot install platform code. But `is_platform_admin` is what grants every site,
   * and the account created here belongs to nobody's site: the moment a first site exists the console
   * answers "No site access — your account is not a member of any site yet", and there is no one with
   * the authority to add them. Reproduced on a fresh PostgreSQL install on 2026-09-14.
   *
   * Safe precisely here and nowhere else: migration 029 refuses to invent an owner on an EXISTING
   * install because that would hand someone powers no operator granted, while this runs only when
   * `count` says there are no users at all.
   */
  it('makes the first administrator the PLATFORM OWNER, not just a tenant admin', async () => {
    const { db } = dbFixture(0);
    const controller = new AuthControllerLifecycle({ db } as any, new AuthManager('test-secret'));

    await (controller as any).createInitialUser('admin@example.test', 'hash');

    expect(db.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      email: 'admin@example.test',
      roles: ['admin'],
      is_platform_admin: true,
    }));
  });

  it('does not insert when another replica got there first while it waited', async () => {
    const { db } = dbFixture(1);
    const controller = new AuthControllerLifecycle({ db } as any, new AuthManager('test-secret'));

    await expect((controller as any).createInitialUser('admin@example.test', 'hash')).resolves.toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('knows nothing about which database it is on', async () => {
    // No `dialect` on the fixture at all: a controller that reads it would fail here.
    const { db } = dbFixture(0);
    const controller = new AuthControllerLifecycle({ db } as any, new AuthManager('test-secret'));

    await expect((controller as any).createInitialUser('admin@example.test', 'hash')).resolves.toMatchObject({ id: 1 });
  });
});
