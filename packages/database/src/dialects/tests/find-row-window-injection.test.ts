import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';

/**
 * `find` on a table named by string wrote `limit` and `offset` into the statement as text. A plugin
 * passing a string there could append its own query past the table guard. It is refused now, and the
 * table it tried to read is never touched.
 */
describe('find with a caller-supplied limit / offset', () => {
  const dbPaths: string[] = [];
  afterEach(() => { for (const filePath of dbPaths.splice(0)) fs.rmSync(filePath, { force: true }); });

  async function manager(): Promise<SqliteDatabaseManager> {
    const dbPath = path.join(os.tmpdir(), `fromcode-row-window-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);
    const db = new SqliteDatabaseManager(dbPath);
    await db.execute('CREATE TABLE "fcp_test_items" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)');
    await db.execute('CREATE TABLE "secrets" ("id" INTEGER, "name" TEXT)');
    await db.execute(`INSERT INTO "secrets" ("id", "name") VALUES (1, 'hunter2')`);
    for (const name of ['a', 'b', 'c']) await db.insert('fcp_test_items', { name });
    return db;
  }

  it('a number, or a numeric string, still pages as before', async () => {
    const db = await manager();
    expect((await db.find('fcp_test_items', { limit: 2 })).map((row: any) => row.name)).toEqual(['a', 'b']);
    expect((await db.find('fcp_test_items', { limit: '1', offset: '2' })).map((row: any) => row.name)).toEqual(['c']);
  });

  it('a limit carrying SQL is refused, and nothing from another table comes back', async () => {
    const db = await manager();
    await expect(db.find('fcp_test_items', { limit: '1 UNION SELECT "id", "name" FROM "secrets"' })).rejects.toThrow(/Invalid limit/);
    await expect(db.find('fcp_test_items', { offset: '0 UNION SELECT "id", "name" FROM "secrets"' })).rejects.toThrow(/Invalid offset/);
  });
});
