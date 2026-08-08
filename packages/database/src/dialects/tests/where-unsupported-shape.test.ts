import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { and, lte, ne, sql } from 'drizzle-orm';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';

/**
 * A `where` that the raw-SQL path cannot parse must FAIL, never quietly become "no filter".
 *
 * `find(tableName, …)` takes the raw-SQL path, where the only supported shape is a plain object
 * (`{ col: value }` / `{ col: { gte, lte } }`). A drizzle expression is a class instance, and the
 * condition builder used to skip anything that was not a plain object — emitting NO WHERE clause and
 * returning every row, while the call site read as a perfectly successful filtered query.
 *
 * That shipped: `WorkflowService.processScheduledContent` filtered with
 * `and(ne(sql.identifier('status'), 'published'), lte(sql.identifier('scheduled_publish_at'), now))`
 * against a string table name, so it matched EVERY row of every workflow-enabled collection. On
 * vselenskiportal88 that re-published all 32 CMS pages on every scheduler tick, overwrote their real
 * `published_at` dates with `now`, and fired 32 spurious `collection:published` hooks each run — and
 * it would have silently published any genuine draft.
 */
describe('raw-SQL where: unsupported shapes fail loudly', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  async function seedManager(): Promise<SqliteDatabaseManager> {
    const dbPath = path.join(os.tmpdir(), `fromcode-where-shape-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);
    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute(
      'CREATE TABLE "fcp_cms_pages" (' +
        '"id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        '"status" TEXT, ' +
        '"scheduled_publish_at" TEXT)'
    );
    await manager.insert('fcp_cms_pages', { status: 'published', scheduledPublishAt: null });
    await manager.insert('fcp_cms_pages', { status: 'published', scheduledPublishAt: null });
    await manager.insert('fcp_cms_pages', { status: 'draft', scheduledPublishAt: '2020-01-01T00:00:00.000Z' });
    return manager;
  }

  it('throws instead of returning every row when handed a drizzle expression', async () => {
    const manager = await seedManager();

    await expect(
      manager.find('fcp_cms_pages', {
        where: and(
          ne(sql.identifier('status'), 'published'),
          lte(sql.identifier('scheduled_publish_at'), new Date().toISOString()),
        ),
      }),
    ).rejects.toThrow(/Unsupported `where`/);
  });

  it('the equivalent plain-object filter selects ONLY the genuinely due row', async () => {
    const manager = await seedManager();

    const rows = await manager.find('fcp_cms_pages', {
      where: {
        status: { ne: 'published' },
        scheduledPublishAt: { lte: new Date().toISOString() },
      },
    });

    // The two published rows are excluded, and so would a draft with a NULL schedule be
    // (`NULL <= now` is NULL, not true) — only a row with a real past date is due.
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('draft');
  });

  it('a published row with a past schedule is still excluded by the status test', async () => {
    const manager = await seedManager();
    await manager.insert('fcp_cms_pages', { status: 'published', scheduledPublishAt: '2019-01-01T00:00:00.000Z' });

    const rows = await manager.find('fcp_cms_pages', {
      where: {
        status: { ne: 'published' },
        scheduledPublishAt: { lte: new Date().toISOString() },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].scheduled_publish_at).toBe('2020-01-01T00:00:00.000Z');
  });

  it('an empty or absent where still means "no filter" — the throw must not break that', async () => {
    const manager = await seedManager();

    expect(await manager.find('fcp_cms_pages', {})).toHaveLength(3);
    expect(await manager.find('fcp_cms_pages', { where: {} })).toHaveLength(3);
  });
});
