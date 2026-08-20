import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';

/**
 * A JS number written to a TEXT column must round-trip as its canonical string, never as a REAL.
 *
 * better-sqlite3 binds EVERY JS number via sqlite3_bind_double, so the integer 5 arrives at SQLite
 * as REAL 5.0 — and TEXT affinity renders REALs with a decimal point. An admin save that merely
 * re-sent untouched relationship ids ('5' read back, coerced to 5 by the entity parser) rewrote
 * user_id/company_id/department_id from '5'/'4'/'1' to '5.0'/'4.0'/'1.0', and every string-equality
 * lookup on those ids silently stopped matching (memberships vanished from the app).
 */
describe('SqliteDatabaseManager — numbers bound at TEXT columns', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  const makeManager = async (): Promise<SqliteDatabaseManager> => {
    const dbPath = path.join(os.tmpdir(), `fromcode-sqlite-text-roundtrip-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);
    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute(
      'CREATE TABLE "fcp_tagiqx_memberships" (' +
        '"id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        '"user_id" TEXT, "company_id" TEXT, "department_id" TEXT, "role" TEXT, "score" REAL)'
    );
    return manager;
  };

  it('updating one field leaves untouched numeric-looking TEXT values byte-identical', async () => {
    const manager = await makeManager();
    await manager.insert('fcp_tagiqx_memberships', {
      userId: '5', companyId: '4', departmentId: '1', role: 'member',
    });

    // The admin edit form re-sends the whole record; the entity parser has already turned the
    // untouched relationship ids into JS numbers by the time they reach the database layer.
    await manager.update('fcp_tagiqx_memberships', { id: 1 }, {
      userId: 5, companyId: 4, departmentId: 1, role: 'admin',
    });

    const row = await manager.findOne('fcp_tagiqx_memberships', { id: 1 });
    expect(row.role).toBe('admin');
    expect(row.user_id).toBe('5');
    expect(row.company_id).toBe('4');
    expect(row.department_id).toBe('1');
  });

  it('inserting a number into a TEXT column stores the canonical string, not a REAL rendering', async () => {
    const manager = await makeManager();
    const row = await manager.insert('fcp_tagiqx_memberships', { userId: 7, role: 'member' });
    expect(row.user_id).toBe('7');
  });

  it('leaves numbers alone for non-text columns', async () => {
    const manager = await makeManager();
    const row = await manager.insert('fcp_tagiqx_memberships', { userId: '5', role: 'member', score: 2.5 });
    expect(row.score).toBe(2.5);
  });

  it('matches TEXT rows when the where value arrives as a number', async () => {
    const manager = await makeManager();
    await manager.insert('fcp_tagiqx_memberships', { userId: '5', role: 'member' });
    const row = await manager.findOne('fcp_tagiqx_memberships', { userId: 5 });
    expect(row?.user_id).toBe('5');
  });
});
