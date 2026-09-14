import { describe, expect, it, vi } from 'vitest';
import { SystemLogRetentionService } from '@core/database/system-log-retention-service';

/**
 * A fake whose `find` serves ids from a pool and whose `delete` removes them, so batching is
 * exercised for real rather than asserted by call count alone.
 */
const makeDb = (options: { retention?: string | null; rows?: Array<{ id: number; tenant_id: string | null }> } = {}) => {
  let pool = [...(options.rows ?? [])];
  const calls: string[] = [];

  const db: any = {
    calls,
    inPlatformScope: false,
    findOne: vi.fn().mockResolvedValue(options.retention === undefined ? { value: '30' } : (options.retention === null ? null : { value: options.retention })),
    withPlatformAdmin: vi.fn(async (fn: () => Promise<unknown>) => {
      db.inPlatformScope = true;
      calls.push('withPlatformAdmin:enter');
      try {
        return await fn();
      } finally {
        db.inPlatformScope = false;
      }
    }),
    count: vi.fn(async () => { calls.push(`count(platformScope=${db.inPlatformScope})`); return pool.length; }),
    find: vi.fn(async (_table: string, opts: any) => {
      calls.push(`find(platformScope=${db.inPlatformScope},limit=${opts?.limit ?? 'none'})`);
      const take = opts?.limit ? pool.slice(0, opts.limit) : pool;
      return take.map((row) => ({ id: row.id, tenant_id: row.tenant_id }));
    }),
    delete: vi.fn(async (_table: string, where: any) => {
      calls.push(`delete(platformScope=${db.inPlatformScope},n=${where?.id?.in?.length})`);
      const ids = new Set(where?.id?.in ?? []);
      pool = pool.filter((row) => !ids.has(row.id));
    }),
    get remaining() { return pool; },
  };
  return db;
};

const rows = (n: number, tenant: string | null, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: from + i + 1, tenant_id: tenant }));

describe('SystemLogRetentionService', () => {
  const makeLogger = () => ({ info: vi.fn(), error: vi.fn() });

  it('treats an unreadable meta table as "no retention configured" instead of rejecting', async () => {
    const db = makeDb();
    db.findOne = vi.fn().mockRejectedValue(new Error('no such table: _system_meta'));
    const logger = makeLogger();

    const removed = await new SystemLogRetentionService(db, logger).pruneFromSettings();

    expect(removed).toBe(0);
    expect(db.count).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('does not prune when the declared window is empty, and never opens a platform scope', async () => {
    const db = makeDb({ retention: null });
    const logger = makeLogger();

    const removed = await new SystemLogRetentionService(db, logger).pruneFromSettings();

    expect(removed).toBe(0);
    expect(db.withPlatformAdmin).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  /**
   * The bug this service shipped with. `_system_logs` is under the journal policy, whose USING clause
   * reaches a site's rows only for a tenant-scoped connection or one carrying the platform marker.
   * The sweep ran untenanted and unmarked, so its DELETE silently narrowed to `tenant_id IS NULL` —
   * it pruned the platform's own stream and never any site's, while reporting the full count.
   */
  it('counts and deletes INSIDE a platform-admin scope, or it only ever reaches platform rows', async () => {
    const db = makeDb({ rows: [...rows(2, null), ...rows(3, 'hub', 10)] });
    const logger = makeLogger();

    await new SystemLogRetentionService(db, logger).pruneFromSettings();

    expect(db.withPlatformAdmin).toHaveBeenCalledOnce();
    expect(db.calls[0]).toBe('withPlatformAdmin:enter');
    expect(db.calls.filter((c: string) => c.startsWith('count') || c.startsWith('delete')))
      .toEqual(expect.arrayContaining([expect.stringContaining('platformScope=true')]));
    expect(db.calls.some((c: string) => c.includes('platformScope=false'))).toBe(false);
  });

  it("removes every owner's rows, not just the platform's", async () => {
    const db = makeDb({ rows: [...rows(2, null), ...rows(3, 'hub', 10), ...rows(1, 'ghost-tenant', 20)] });

    const removed = await new SystemLogRetentionService(db, makeLogger()).pruneFromSettings();

    expect(removed).toBe(6);
    expect(db.remaining).toEqual([]);
  });

  it('names who the doomed rows belong to BEFORE deleting them', async () => {
    const db = makeDb({ rows: [...rows(2, null), ...rows(3, 'hub', 10)] });
    const logger = makeLogger();

    await new SystemLogRetentionService(db, logger).pruneFromSettings();

    const announced = logger.info.mock.calls[0][0] as string;
    expect(announced).toContain('platform=2');
    expect(announced).toContain('hub=3');
    // Said before anything went, so the operator can see whose history was cleared.
    expect(logger.info.mock.calls[1][0]).toContain('Removed 5');
  });

  it('deletes in batches rather than one statement over the whole backlog', async () => {
    const db = makeDb({ rows: rows(2300, 'hub') });

    const removed = await new SystemLogRetentionService(db, makeLogger()).pruneFromSettings();

    expect(removed).toBe(2300);
    expect(db.delete.mock.calls.map((c: any[]) => c[1].id.in.length)).toEqual([1000, 1000, 300]);
  });

  it('reports what was ACTUALLY removed, not the pre-count', async () => {
    const db = makeDb({ rows: rows(4, 'hub') });
    // A count that disagrees with what the rows allow — the shape RLS produced.
    db.count = vi.fn().mockResolvedValue(999);

    const removed = await new SystemLogRetentionService(db, makeLogger()).pruneFromSettings();

    expect(removed).toBe(4);
  });

  it('works on a dialect whose withPlatformAdmin simply runs the callback', async () => {
    const db = makeDb({ rows: rows(3, null) });
    db.withPlatformAdmin = vi.fn(async (fn: () => Promise<unknown>) => fn());

    const removed = await new SystemLogRetentionService(db, makeLogger()).pruneFromSettings();

    expect(removed).toBe(3);
  });
});
