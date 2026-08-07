import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';

/**
 * The drizzle branches of `find`/`count` build their WHERE via `BaseDialect.buildWhereConditions`, which
 * emitted `eq(sql.identifier(key), value)` VERBATIM. Canonical field names are camelCase and the physical
 * columns are snake_case, so `{ where: { affiliateCode } }` produced `"affiliateCode" = ?` — the same
 * unresolvable-identifier bug the search columns had. Postgres `count()` used to carry a local workaround
 * for this; the normalization now lives in one place for every dialect and both call paths.
 */
describe('where column naming', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  async function seedManager(): Promise<SqliteDatabaseManager> {
    const dbPath = path.join(os.tmpdir(), `fromcode-where-naming-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute(
      'CREATE TABLE "fcp_test_referrals" (' +
        '"id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        '"affiliate_code" TEXT, ' +
        '"customer_email" TEXT)'
    );
    await manager.insert('fcp_test_referrals', { affiliateCode: 'ALPHA123', customerEmail: 'ann@example.com' });
    await manager.insert('fcp_test_referrals', { affiliateCode: 'BETA456', customerEmail: 'ben@example.com' });
    await manager.insert('fcp_test_referrals', { affiliateCode: 'BETA456', customerEmail: 'bob@example.com' });
    return manager;
  }

  /** camelCase JS keys mapped to snake_case physical columns — the normal drizzle shape. */
  const referralsTable = sqliteTable('fcp_test_referrals', {
    id: integer('id'),
    affiliateCode: text('affiliate_code'),
    customerEmail: text('customer_email'),
  });

  it('find() resolves a camelCase where key against the snake_case column', async () => {
    const manager = await seedManager();

    const rows = await manager.find(referralsTable, { where: { affiliateCode: 'BETA456' } });

    expect(rows).toHaveLength(2);
    expect(rows.every((row: any) => row.affiliateCode === 'BETA456')).toBe(true);
  });

  it('count() resolves a camelCase where key against the snake_case column', async () => {
    const manager = await seedManager();

    expect(await manager.count(referralsTable, { where: { affiliateCode: 'BETA456' } })).toBe(2);
    expect(await manager.count(referralsTable, { where: { affiliateCode: 'ALPHA123' } })).toBe(1);
    expect(await manager.count(referralsTable, { where: { affiliateCode: 'NOPE' } })).toBe(0);
  });

  it('count() on a string table name resolves a camelCase where key', async () => {
    const manager = await seedManager();

    expect(await manager.count('fcp_test_referrals', { where: { affiliateCode: 'BETA456' } })).toBe(2);
  });

  it('does NOT over-normalize a column whose PHYSICAL name is genuinely camelCase', async () => {
    const dbPath = path.join(os.tmpdir(), `fromcode-where-camel-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);
    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute('CREATE TABLE "fcp_test_camel" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "fooBar" TEXT)');
    await manager.execute(`INSERT INTO "fcp_test_camel" ("fooBar") VALUES ('kept')`);

    // The table object DECLARES the physical name, so the declared column must win over snake-casing.
    const camelTable = sqliteTable('fcp_test_camel', { id: integer('id'), fooBar: text('fooBar') });

    const rows = await manager.find(camelTable, { where: { fooBar: 'kept' } });
    expect(rows).toHaveLength(1);
    expect(await manager.count(camelTable, { where: { fooBar: 'kept' } })).toBe(1);
  });
});
