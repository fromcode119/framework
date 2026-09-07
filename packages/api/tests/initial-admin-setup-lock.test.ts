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
