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

  it('runs one holder at a time across two pools, and releases on failure', async () => {
    a!.markAsPlatformConnection();
    b!.markAsPlatformConnection();
    const events: string[] = [];
    const work = (who: string) => async () => {
      events.push(`${who}:start`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      events.push(`${who}:end`);
    };
    const name = `test-lock-${Date.now()}`;
    await Promise.all([a!.withSessionLock(name, work('a')), new Promise((r) => setTimeout(r, 20)).then(() => b!.withSessionLock(name, work('b')))]);
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
});
