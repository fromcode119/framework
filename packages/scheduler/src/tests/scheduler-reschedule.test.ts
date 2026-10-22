import { afterEach, describe, expect, it } from 'vitest';
import { SchedulerService } from '@scheduler/index';
import { ScheduleType } from '@scheduler/enums/schedule-type.enum';

/**
 * A task's schedule can change while the api runs — an operator shortening how often Sources checks for
 * new commits. The new schedule must take over at once: no wait for the old interval's next_run, and no
 * cron timer left firing on the old expression.
 */
class TasksTable {
  readonly rows = new Map<string, Record<string, any>>();

  readonly db: any = {
    find: async (_table: string, query: { where: { name: string } }) => {
      const row = this.rows.get(query.where.name);
      return row ? [{ ...row }] : [];
    },
    insert: async (_table: string, data: Record<string, any>) => { this.rows.set(data.name, { ...data }); return data; },
    update: async (_table: string, where: { name: string }, data: Record<string, any>) => {
      const row = this.rows.get(where.name);
      if (!row) return null;
      Object.assign(row, data);
      return { ...row };
    },
  };
}

describe('SchedulerService rescheduling', () => {
  let scheduler: SchedulerService;
  afterEach(() => scheduler?.stop());

  it('counts a shortened interval from now, not from the old next run', async () => {
    const table = new TasksTable();
    scheduler = new SchedulerService(table.db);
    await scheduler.register('checks', '1h', async () => undefined);
    await scheduler.register('checks', '2m', async () => undefined);

    const next = new Date(table.rows.get('checks')!.next_run).getTime() - Date.now();
    expect(next).toBeGreaterThan(60_000);
    expect(next).toBeLessThanOrEqual(120_000);
    expect(table.rows.get('checks')!.schedule).toBe('2m');
  });

  it('keeps the next run of an interval whose schedule did not change', async () => {
    const table = new TasksTable();
    scheduler = new SchedulerService(table.db);
    await scheduler.register('checks', '5m', async () => undefined);
    const first = table.rows.get('checks')!.next_run;
    await scheduler.register('checks', '5m', async () => undefined);

    expect(table.rows.get('checks')!.next_run).toBe(first);
  });

  it('stops the cron timer of a task that moved to an interval', async () => {
    const table = new TasksTable();
    scheduler = new SchedulerService(table.db);
    await scheduler.register('checks', '*/15 * * * *', async () => undefined);
    expect((scheduler as any).cron.nextRun('checks')).not.toBeNull();

    await scheduler.register('checks', '5m', async () => undefined);

    expect((scheduler as any).cron.nextRun('checks')).toBeNull();
    expect(ScheduleType.resolve(table.rows.get('checks')!.type)).toBe(ScheduleType.INTERVAL);
    expect(table.rows.get('checks')!.next_run).toBeInstanceOf(Date);
  });

  it('deactivates a task until it is scheduled again', async () => {
    const table = new TasksTable();
    scheduler = new SchedulerService(table.db);
    await scheduler.register('checks', '5m', async () => undefined);
    await scheduler.deactivate('checks');

    expect(table.rows.get('checks')).toMatchObject({ is_active: false, next_run: null });

    await scheduler.register('checks', '5m', async () => undefined);
    expect(table.rows.get('checks')!.is_active).toBe(true);
    expect(table.rows.get('checks')!.next_run).toBeInstanceOf(Date);
  });
});
