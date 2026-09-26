import { describe, expect, it } from 'vitest';
import { SchedulerRunClaim } from '@scheduler/scheduler-run-claim';

/**
 * Two api instances fire the same schedule together — always during a rolling deploy. Each firing must
 * run on exactly one of them. The fake store matches an update only when EVERY where-value equals the
 * row as stored (dates by time), which is what the Postgres dialect's `update(table, where, data)` does.
 */
class TasksTable {
  private readonly rows = new Map<string, Record<string, unknown>>();

  constructor(rows: Array<Record<string, unknown>>) {
    for (const row of rows) this.rows.set(String(row.name), { ...row });
  }

  private static same(a: unknown, b: unknown): boolean {
    if (a instanceof Date || b instanceof Date) return a != null && b != null && new Date(a as Date).getTime() === new Date(b as Date).getTime();
    return a === b;
  }

  readonly db: any = {
    findOne: async (_table: string, where: { name: string }) => {
      const row = this.rows.get(where.name);
      return row ? { ...row } : null;
    },
    update: async (_table: string, where: Record<string, unknown>, data: Record<string, unknown>) => {
      const row = this.rows.get(String(where.name));
      if (!row || !Object.entries(where).every(([k, v]) => TasksTable.same(row[k], v))) return null;
      Object.assign(row, data);
      return { ...row };
    },
  };
}

describe('SchedulerRunClaim', () => {
  const firedAt = new Date('2026-09-26T10:15:00.120Z');

  it('lets exactly one of two instances run a cron firing they read at the same moment', async () => {
    const table = new TasksTable([{ name: 'reminders', last_run: new Date('2026-09-26T10:00:00Z'), updated_at: new Date('2026-09-26T10:00:00Z') }]);
    const a = new SchedulerRunClaim(table.db, 't');
    const b = new SchedulerRunClaim(table.db, 't');

    const results = await Promise.all([a.claimCron('reminders', firedAt, 60_000), b.claimCron('reminders', firedAt, 60_000)]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('turns away an instance that reads the row after the slot was already claimed', async () => {
    const table = new TasksTable([{ name: 'reminders', last_run: new Date('2026-09-26T10:00:00Z'), updated_at: new Date('2026-09-26T10:00:00Z') }]);
    const claim = new SchedulerRunClaim(table.db, 't');

    expect(await claim.claimCron('reminders', firedAt, 60_000)).toBe(true);
    expect(await claim.claimCron('reminders', new Date(firedAt.getTime() + 800), 60_000)).toBe(false);
    // The next slot is a new firing.
    expect(await claim.claimCron('reminders', new Date('2026-09-26T10:30:00.050Z'), 60_000)).toBe(true);
  });

  it('claims a task that has never run and has no updated_at yet', async () => {
    const table = new TasksTable([{ name: 'fresh', last_run: null, updated_at: null }]);
    const claim = new SchedulerRunClaim(table.db, 't');

    expect(await claim.claimCron('fresh', firedAt, 60_000)).toBe(true);
    expect(await claim.claimCron('fresh', firedAt, 60_000)).toBe(false);
  });

  it('lets exactly one instance run a due interval task', async () => {
    const due = new Date('2026-09-26T10:15:00Z');
    const table = new TasksTable([{ name: 'exports', next_run: due, last_run: null }]);
    const next = new Date('2026-09-26T10:20:00Z');
    const results = await Promise.all([
      new SchedulerRunClaim(table.db, 't').claimInterval('exports', due, next),
      new SchedulerRunClaim(table.db, 't').claimInterval('exports', due, next),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('knows a seconds-level cron expression from a minutes-level one', () => {
    expect(SchedulerRunClaim.slotMsFor('*/15 * * * *')).toBe(60_000);
    expect(SchedulerRunClaim.slotMsFor('*/10 * * * * *')).toBe(1000);
  });
});
