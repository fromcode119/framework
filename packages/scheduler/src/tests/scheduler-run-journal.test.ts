import { describe, expect, it, vi } from 'vitest';
import { SchedulerRunJournal } from '@scheduler/scheduler-run-journal';

/** One table, as the dialect's insert/update treat it: insert returns the row with its id. */
class RunsTable {
  readonly rows: Array<Record<string, unknown>> = [];
  readonly db: any = {
    insert: vi.fn(async (_table: string, row: Record<string, unknown>) => {
      const stored = { ...row, id: this.rows.length + 1 };
      this.rows.push(stored);
      return stored;
    }),
    update: vi.fn(async (_table: string, where: { id: number }, data: Record<string, unknown>) => Object.assign(this.rows[where.id - 1], data)),
  };
}

describe('SchedulerRunJournal', () => {
  it('records a run that worked: when, how long, no error', async () => {
    const table = new RunsTable();
    const result = await new SchedulerRunJournal(table.db).record({ taskName: 'migrate:migrate-sync', pluginSlug: 'migrate' }, async () => 'done');

    expect(result).toBe('done');
    expect(table.rows[0]).toMatchObject({ task_name: 'migrate:migrate-sync', plugin_slug: 'migrate', parent_id: null, status: 'succeeded', error: null });
    expect(typeof table.rows[0].duration_ms).toBe('number');
    expect(table.rows[0].finished_at).toBeInstanceOf(Date);
  });

  it('records a run that failed with its error, and still hands the error to the caller', async () => {
    const table = new RunsTable();
    const journal = new SchedulerRunJournal(table.db);

    await expect(journal.record({ taskName: 'content-workflows' }, async () => { throw new Error('the database went away'); })).rejects.toThrow('the database went away');
    expect(table.rows[0]).toMatchObject({ task_name: 'content-workflows', plugin_slug: null, status: 'failed', error: 'the database went away' });
  });

  it('files a run made inside another run under it', async () => {
    const table = new RunsTable();
    const journal = new SchedulerRunJournal(table.db);

    await journal.record({ taskName: 'migrate:migrate-sync', pluginSlug: 'migrate' }, async () => {
      await journal.record({ taskName: 'migrate:migrate-sync', pluginSlug: 'migrate', parentId: SchedulerRunJournal.currentRunId() }, async () => undefined);
    });

    expect(table.rows.map((row) => [row.id, row.parent_id])).toEqual([[1, null], [2, 1]]);
    expect(SchedulerRunJournal.currentRunId()).toBeNull();
  });

  it('still runs the job when its row cannot be written', async () => {
    const db = { insert: vi.fn(async () => { throw new Error('no table yet'); }), update: vi.fn() };
    const work = vi.fn(async () => 'ran');

    await expect(new SchedulerRunJournal(db as any).record({ taskName: 'x' }, work)).resolves.toBe('ran');
    expect(work).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });
});
