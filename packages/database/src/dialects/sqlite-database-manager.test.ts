import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from './sqlite-database-manager';

describe('SqliteDatabaseManager.addColumn', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  it('adds unique columns through a follow-up unique index', async () => {
    const dbPath = path.join(os.tmpdir(), `fromcode-sqlite-add-column-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute('CREATE TABLE "fcp_test_items" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)');

    await manager.addColumn('fcp_test_items', {
      name: 'customPermalink',
      type: 'text',
      unique: true,
    } as any);

    await manager.insert('fcp_test_items', { name: 'First', customPermalink: '/alpha' });
    await expect(
      manager.insert('fcp_test_items', { name: 'Second', customPermalink: '/alpha' })
    ).rejects.toThrow();
  });
});