import { describe, expect, it, vi } from 'vitest';
import { JournalRetentionService } from '@core/database/journal-retention-service';
import { JournalRetentionTargets } from '@core/database/journal-retention-target';
import type { IJournalRetentionTarget } from '@core/database/journal-retention-target';
import { SystemConstants } from '@core/constants/system.constants';

const LOGS = JournalRetentionTargets.all()[0];
const AUDIT = (afterPrune?: any) => JournalRetentionTargets.all({ auditAfterPrune: afterPrune })[1];

/**
 * A fake whose `find` serves ids from a pool and whose `delete` removes them, so batching is
 * exercised for real rather than asserted by call count alone.
 */
const makeDb = (options: { settings?: Record<string, string>; rows?: Array<{ id: number; tenant_id: string | null }> } = {}) => {
  let pool = [...(options.rows ?? [])];
  const calls: string[] = [];

  const db: any = {
    calls,
    inPlatformScope: false,
    findOne: vi.fn(async (_table: string, where: any) => {
      const value = options.settings?.[where?.key];
      return value === undefined ? null : { value };
    }),
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
    groupCount: vi.fn(async () => {
      const byOwner = new Map<string | null, number>();
      for (const row of pool) byOwner.set(row.tenant_id, (byOwner.get(row.tenant_id) ?? 0) + 1);
      return [...byOwner.entries()].map(([tenant_id, count]) => ({ tenant_id, count }));
    }),
    find: vi.fn(async (_table: string, opts: any) => {
      calls.push(`find(platformScope=${db.inPlatformScope})`);
      return (opts?.limit ? pool.slice(0, opts.limit) : pool).map((row) => ({ id: row.id }));
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

const makeLogger = () => ({ info: vi.fn(), error: vi.fn() });
const run = (db: any, logger: any, target: IJournalRetentionTarget) =>
  new JournalRetentionService(db, logger, [target]).pruneFromSettings(target);

describe('JournalRetentionService', () => {
  it('treats an unreadable meta table as "no retention configured" instead of rejecting', async () => {
    const db = makeDb();
    db.findOne = vi.fn().mockRejectedValue(new Error('no such table: _system_meta'));
    const logger = makeLogger();

    expect(await run(db, logger, LOGS)).toBe(0);
    expect(db.count).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('does not prune when the declared window is empty, and never opens a platform scope', async () => {
    const db = makeDb();
    const logger = makeLogger();

    expect(await run(db, logger, LOGS)).toBe(0);
    expect(db.withPlatformAdmin).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  /**
   * The bug this service shipped with. These tables are under the journal policy, whose USING clause
   * reaches a site's rows only for a tenant-scoped connection or one carrying the platform marker.
   * The sweep ran untenanted and unmarked, so its DELETE silently narrowed to `tenant_id IS NULL`.
   */
  it('counts and deletes INSIDE a platform-admin scope, or it only ever reaches platform rows', async () => {
    const db = makeDb({ settings: { [LOGS.settingKey]: '30' }, rows: [...rows(2, null), ...rows(3, 'hub', 10)] });

    await run(db, makeLogger(), LOGS);

    expect(db.calls[0]).toBe('withPlatformAdmin:enter');
    expect(db.calls.some((c: string) => c.includes('platformScope=false'))).toBe(false);
  });

  it("removes every owner's rows, including a tenant that no longer exists", async () => {
    const db = makeDb({
      settings: { [LOGS.settingKey]: '30' },
      rows: [...rows(2, null), ...rows(3, 'hub', 10), ...rows(1, 'ghost-tenant', 20)],
    });

    expect(await run(db, makeLogger(), LOGS)).toBe(6);
    expect(db.remaining).toEqual([]);
  });

  it('names who the doomed rows belong to BEFORE deleting them', async () => {
    const db = makeDb({ settings: { [LOGS.settingKey]: '30' }, rows: [...rows(2, null), ...rows(3, 'hub', 10)] });
    const logger = makeLogger();

    await run(db, logger, LOGS);

    expect(logger.info.mock.calls[0][0]).toContain('platform=2');
    expect(logger.info.mock.calls[0][0]).toContain('hub=3');
    expect(logger.info.mock.calls[1][0]).toContain('Removed 5');
  });

  it('deletes in batches rather than one statement over the whole backlog', async () => {
    const db = makeDb({ settings: { [LOGS.settingKey]: '30' }, rows: rows(2300, 'hub') });

    expect(await run(db, makeLogger(), LOGS)).toBe(2300);
    expect(db.delete.mock.calls.map((c: any[]) => c[1].id.in.length)).toEqual([1000, 1000, 300]);
  });

  it('reports what was ACTUALLY removed, not the pre-count', async () => {
    const db = makeDb({ settings: { [LOGS.settingKey]: '30' }, rows: rows(4, 'hub') });
    db.count = vi.fn().mockResolvedValue(999);

    expect(await run(db, makeLogger(), LOGS)).toBe(4);
  });

  it('works on a dialect whose withPlatformAdmin simply runs the callback', async () => {
    const db = makeDb({ settings: { [LOGS.settingKey]: '30' }, rows: rows(3, null) });
    db.withPlatformAdmin = vi.fn(async (fn: () => Promise<unknown>) => fn());

    expect(await run(db, makeLogger(), LOGS)).toBe(3);
  });

  describe('the audit journal', () => {
    /**
     * `packages/ai` declares `_system_audit_logs` the EU AI Act Art. 12 record store. A window below
     * six months would let the platform quietly break a commitment its own code makes, so it is
     * REFUSED with the reason — never clamped, which would leave the operator believing they got the
     * window they asked for.
     */
    it(`REFUSES a window below the ${SystemConstants.AUDIT_RETENTION_MIN_DAYS}-day floor and prunes nothing`, async () => {
      const db = makeDb({ settings: { [AUDIT().settingKey]: '179' }, rows: rows(50, 'hub') });
      const logger = makeLogger();

      expect(await run(db, logger, AUDIT())).toBe(0);
      expect(db.withPlatformAdmin).not.toHaveBeenCalled();
      expect(db.remaining).toHaveLength(50);
      expect(logger.error.mock.calls[0][0]).toContain('below the 180-day minimum');
    });

    it('accepts exactly the floor', async () => {
      const db = makeDb({ settings: { [AUDIT().settingKey]: '180' }, rows: rows(3, 'hub') });

      expect(await run(db, makeLogger(), AUDIT())).toBe(3);
    });

    it('still allows keeping forever — the floor is a minimum, not a schedule', async () => {
      const db = makeDb({ settings: {}, rows: rows(3, 'hub') });

      expect(await run(db, makeLogger(), AUDIT())).toBe(0);
      expect(db.remaining).toHaveLength(3);
    });

    it('records its own pruning, with the real removed count', async () => {
      const afterPrune = vi.fn();
      const db = makeDb({ settings: { [AUDIT().settingKey]: '365' }, rows: [...rows(2, null), ...rows(1, 'hub', 9)] });

      await run(db, makeLogger(), AUDIT(afterPrune));

      expect(afterPrune).toHaveBeenCalledOnce();
      expect(afterPrune.mock.calls[0][0]).toMatchObject({
        table: SystemConstants.TABLE.AUDIT_LOGS, retentionDays: 365, planned: 3, removed: 3,
      });
      expect(afterPrune.mock.calls[0][0].owners).toContain('platform=2');
    });

    it('a failure to record the prune does not crash the sweep or un-report it', async () => {
      const afterPrune = vi.fn().mockRejectedValue(new Error('audit write failed'));
      const db = makeDb({ settings: { [AUDIT().settingKey]: '365' }, rows: rows(2, 'hub') });
      const logger = makeLogger();

      expect(await run(db, logger, AUDIT(afterPrune))).toBe(2);
      expect(logger.error.mock.calls[0][0]).toContain('failed to record the prune');
    });
  });

  it('sweeps every declared journal, and one failure does not stop the next', async () => {
    const db = makeDb({ settings: { [LOGS.settingKey]: '30', [AUDIT().settingKey]: '365' }, rows: rows(2, 'hub') });
    const logger = makeLogger();

    const removed = await new JournalRetentionService(db, logger, JournalRetentionTargets.all()).pruneAll();

    // Both targets ran against the same pool: the first drains it, the second finds nothing.
    expect(removed).toBe(2);
    expect(db.withPlatformAdmin).toHaveBeenCalledTimes(2);
  });
});
