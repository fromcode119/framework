import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';

/**
 * `groupCount` is SQL aggregation — the database counts, the application reads counts.
 *
 * It exists because the activity screen used to page every row of a window into memory to add them
 * up, which put a ceiling on honesty: past the scan cap the totals were simply wrong. A GROUP BY has
 * no such cap.
 */
describe('groupCount', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  async function makeDb(): Promise<SqliteDatabaseManager> {
    const dbPath = path.join(os.tmpdir(), `fromcode-sqlite-group-count-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute('CREATE TABLE "fcp_log" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "outcome" TEXT, "media_id" INTEGER, "created_at" TEXT)');
    const rows: Array<[string, number | null, string]> = [
      ['granted', null, '2026-08-15 10:00:00'],
      ['granted', null, '2026-08-15 11:00:00'],
      ['granted', 7, '2026-08-15 12:00:00'],
      ['granted', 7, '2026-08-16 09:00:00'],
      ['granted', 9, '2026-08-16 10:00:00'],
      ['expired', null, '2026-08-16 11:00:00'],
      ['unknown', null, '2026-08-17 08:00:00'],
      ['unknown', null, '2026-08-17 09:00:00'],
    ];
    for (const [outcome, mediaId, createdAt] of rows) {
      await manager.insert('fcp_log', { outcome, mediaId, createdAt });
    }
    return manager;
  }

  it('counts per column value, biggest first', async () => {
    const manager = await makeDb();
    const rows = await manager.groupCount('fcp_log', { groupBy: ['outcome'] });
    expect(rows[0]).toMatchObject({ outcome: 'granted', count: 5 });
    expect(rows.find((row) => row.outcome === 'unknown')).toMatchObject({ count: 2 });
    expect(rows.find((row) => row.outcome === 'expired')).toMatchObject({ count: 1 });
  });

  it('buckets by calendar day', async () => {
    const manager = await makeDb();
    const rows = await manager.groupCount('fcp_log', { dateBucket: { column: 'created_at' } });
    const byDay = Object.fromEntries(rows.map((row) => [row.day, row.count]));
    expect(byDay).toEqual({ '2026-08-15': 3, '2026-08-16': 3, '2026-08-17': 2 });
  });

  it('honours a null-operand where alongside grouping', async () => {
    const manager = await makeDb();
    // Downloads per file: granted AND media_id IS NOT NULL — the exact question the activity screen
    // asks, and the one the pre-fix layer could not express.
    const rows = await manager.groupCount('fcp_log', {
      where: { outcome: 'granted', mediaId: { ne: null } },
      groupBy: ['media_id'],
      limit: 10,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ media_id: 7, count: 2 });
    expect(rows[1]).toMatchObject({ media_id: 9, count: 1 });
  });

  it('refuses to run with nothing to group by', async () => {
    const manager = await makeDb();
    await expect(manager.groupCount('fcp_log', {})).rejects.toThrow(/at least one/);
  });
});
