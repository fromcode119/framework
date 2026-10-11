import { afterAll, describe, expect, it } from 'vitest';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';

/**
 * Two api processes booting at once must not migrate at the same time. Two managers (two pools, as two
 * processes would have) take the same session lock: the second waits for the first to finish, and the
 * work itself runs outside any transaction. SKIPS without the owner connection URL, as the binding suite does.
 */
const ownerUrl = process.env.TENANT_TEST_OWNER_URL;

describe.skipIf(!ownerUrl)('withSessionLock (real Postgres)', () => {
  const a = ownerUrl ? new PostgresDatabaseManager(ownerUrl) : null;
  const b = ownerUrl ? new PostgresDatabaseManager(ownerUrl) : null;
  afterAll(async () => { await (a as any)?.pool.end(); await (b as any)?.pool.end(); });

  /** Resolves once some session is queued on the advisory lock `name` without holding it. */
  const waiterQueuedOn = async (name: string): Promise<void> => {
    for (;;) {
      const rows = await a!.queryRaw(
        `SELECT count(*)::int AS waiting FROM pg_locks
          WHERE locktype = 'advisory' AND NOT granted
            AND classid = ((hashtext($1)::bigint >> 32) & 4294967295)::oid
            AND objid = (hashtext($1)::bigint & 4294967295)::oid`,
        [name],
      );
      if ((rows[0] as any).waiting > 0) return;
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  it('runs one holder at a time across two pools, and releases on failure', async () => {
    a!.markAsPlatformConnection();
    b!.markAsPlatformConnection();
    const name = `test-lock-${Date.now()}`;
    const events: string[] = [];
    // b only asks once a HOLDS the lock, and a only finishes once Postgres shows b queued behind it —
    // so the order below is fixed by the lock itself, not by which pool opens its connection first.
    let aHolds!: () => void;
    const aHoldsLock = new Promise<void>((resolve) => { aHolds = resolve; });
    const first = a!.withSessionLock(name, async () => {
      events.push('a:start');
      aHolds();
      await waiterQueuedOn(name);
      events.push('a:end');
    });
    await aHoldsLock;
    const second = b!.withSessionLock(name, async () => {
      events.push('b:start');
      events.push('b:end');
    });
    await Promise.all([first, second]);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);

    await expect(a!.withSessionLock(name, async () => { throw new Error('migration failed'); })).rejects.toThrow('migration failed');
    // Released despite the failure: the next holder gets it at once.
    await expect(b!.withSessionLock(name, async () => 'next')).resolves.toBe('next');
  });

  it('does not wrap the work in a transaction', async () => {
    const inTransaction = await a!.withSessionLock(`test-lock-tx-${Date.now()}`, async () => {
      const rows = await a!.queryRaw("SELECT count(*)::int AS open FROM pg_stat_activity WHERE pid = pg_backend_pid() AND state = 'idle in transaction'");
      return (rows[0] as any).open;
    });
    expect(inTransaction).toBe(0);
  });

  it('closes the connection instead of pooling it when the unlock is not confirmed', async () => {
    const name = `test-lock-unlock-${Date.now()}`;
    const pool = (a as any).pool;
    const connect = pool.connect.bind(pool);
    let holder: any;
    pool.connect = async () => {
      holder = await connect();
      const query = holder.query.bind(holder);
      holder.query = (text: string, values?: unknown[]) =>
        text.includes('pg_advisory_unlock') ? Promise.reject(new Error('connection lost')) : query(text, values);
      return holder;
    };
    try {
      await a!.withSessionLock(name, async () => undefined);
    } finally {
      pool.connect = connect;
    }
    expect(holder._ending).toBe(true);
    // The lock that session still held went with it: another process gets it at once.
    await expect(b!.withSessionLock(name, async () => 'free')).resolves.toBe('free');
  });
});
