import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';

/**
 * A null operand in a `where` means ABSENCE and must emit IS NULL / IS NOT NULL.
 *
 * It used to emit `column = ?` with a NULL parameter, which is never true in SQL — so
 * `{ revoked_at: null }` guards matched nothing, `update` calls reported "0 rows" for rows that were
 * plainly there, and `{ ne: null }` filters returned nothing at all. Both raw-SQL paths and the
 * drizzle path share the rule now; these tests pin the whole surface: find, count, update.
 */
describe('where with a null operand', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  async function makeDb(): Promise<SqliteDatabaseManager> {
    const dbPath = path.join(os.tmpdir(), `fromcode-sqlite-null-where-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute('CREATE TABLE "fcp_null_items" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "label" TEXT, "revoked_at" TEXT, "media_id" INTEGER)');
    await manager.insert('fcp_null_items', { label: 'live', revokedAt: null, mediaId: null });
    await manager.insert('fcp_null_items', { label: 'revoked', revokedAt: '2026-08-01 10:00:00', mediaId: 7 });
    await manager.insert('fcp_null_items', { label: 'live-download', revokedAt: null, mediaId: 9 });
    return manager;
  }

  it('eq null finds the rows where the column IS NULL', async () => {
    const manager = await makeDb();
    const rows = await manager.find('fcp_null_items', { where: { revokedAt: null } });
    expect(rows.map((row: any) => row.label).sort()).toEqual(['live', 'live-download']);
  });

  it('ne null finds the rows where the column IS NOT NULL', async () => {
    const manager = await makeDb();
    const rows = await manager.find('fcp_null_items', { where: { mediaId: { ne: null } } });
    expect(rows.map((row: any) => row.label).sort()).toEqual(['live-download', 'revoked']);
  });

  it('counts by null the same way find does', async () => {
    const manager = await makeDb();
    expect(await manager.count('fcp_null_items', { where: { mediaId: null } })).toBe(1);
    expect(await manager.count('fcp_null_items', { where: { mediaId: { ne: null } } })).toBe(2);
  });

  it('a null guard in an update WHERE actually guards', async () => {
    const manager = await makeDb();
    // The original motivating bug: "edit unless revoked". With `= NULL` this matched nothing and the
    // edit silently reported no change for a perfectly live row.
    const updated = await manager.update('fcp_null_items', { label: 'live', revokedAt: null }, { label: 'edited' });
    expect(updated?.label).toBe('edited');

    const guarded = await manager.update('fcp_null_items', { label: 'revoked', revokedAt: null }, { label: 'nope' });
    expect(guarded ?? null).toBeNull();
  });

  it('mixes null and non-null predicates in one where', async () => {
    const manager = await makeDb();
    const rows = await manager.find('fcp_null_items', { where: { revokedAt: null, mediaId: { ne: null } } });
    expect(rows.map((row: any) => row.label)).toEqual(['live-download']);
  });

  it('refuses a range operator against null instead of matching nothing', async () => {
    const manager = await makeDb();
    await expect(manager.find('fcp_null_items', { where: { mediaId: { gte: null } } })).rejects.toThrow(/cannot take null/);
  });
});
