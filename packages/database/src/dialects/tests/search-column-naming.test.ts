import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';

/**
 * `search.columns` carries CANONICAL camelCase schema field names, exactly like `where` keys — the
 * physical columns are snake_case. The dialects used to emit those names verbatim, and SQLite does not
 * error on a double-quoted identifier that matches no column: it degrades to a STRING LITERAL. So
 * `"affiliateCode" LIKE '%ALPHA%'` compared the literal text `affiliateCode` and matched NOTHING, while
 * `'%ffil%'` (a substring of the column NAME) matched EVERY row — a search that silently returned either
 * nothing or the entire unfiltered table.
 */
describe('search column naming', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  async function seedManager(): Promise<SqliteDatabaseManager> {
    const dbPath = path.join(os.tmpdir(), `fromcode-search-naming-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute(
      'CREATE TABLE "fcp_test_referrals" (' +
        '"id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        '"affiliate_code" TEXT, ' +
        '"customer_email" TEXT, ' +
        '"status" TEXT)'
    );
    await manager.insert('fcp_test_referrals', { affiliateCode: 'ALPHA123', customerEmail: 'ann@example.com', status: 'paid' });
    await manager.insert('fcp_test_referrals', { affiliateCode: 'BETA456', customerEmail: 'ben@example.com', status: 'paid' });
    await manager.insert('fcp_test_referrals', { affiliateCode: 'GAMMA789', customerEmail: 'gil@example.com', status: 'pending' });
    return manager;
  }

  /** Drizzle table object: camelCase JS keys mapped to snake_case physical columns. */
  const referralsTable = sqliteTable('fcp_test_referrals', {
    id: integer('id'),
    affiliateCode: text('affiliate_code'),
    customerEmail: text('customer_email'),
    status: text('status'),
  });

  describe('raw string-table path', () => {
    it('matches rows by the underlying snake_case column when given a camelCase search column', async () => {
      const manager = await seedManager();

      const rows = await manager.find('fcp_test_referrals', {
        search: { columns: ['affiliateCode'], value: 'ALPHA' },
      });

      expect(rows.map((row: any) => row.affiliate_code ?? row.affiliateCode)).toEqual(['ALPHA123']);
    });

    it('does NOT match every row when the term is a substring of the column name', async () => {
      const manager = await seedManager();

      const rows = await manager.find('fcp_test_referrals', {
        search: { columns: ['affiliateCode'], value: 'ffil' },
      });

      expect(rows).toEqual([]);
    });

    it('ORs multiple camelCase search columns against their snake_case columns', async () => {
      const manager = await seedManager();

      const rows = await manager.find('fcp_test_referrals', {
        search: { columns: ['affiliateCode', 'customerEmail'], value: 'ben@' },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].customer_email ?? rows[0].customerEmail).toBe('ben@example.com');
    });

    it('ANDs the search with an exact where filter', async () => {
      const manager = await seedManager();

      const rows = await manager.find('fcp_test_referrals', {
        where: { status: 'pending' },
        search: { columns: ['affiliateCode'], value: 'A' },
      });

      expect(rows.map((row: any) => row.affiliate_code ?? row.affiliateCode)).toEqual(['GAMMA789']);
    });

    it('still resolves a search column already given in snake_case', async () => {
      const manager = await seedManager();

      const rows = await manager.find('fcp_test_referrals', {
        search: { columns: ['affiliate_code'], value: 'BETA' },
      });

      expect(rows.map((row: any) => row.affiliate_code ?? row.affiliateCode)).toEqual(['BETA456']);
    });
  });

  describe('drizzle table-object path', () => {
    it('matches by the mapped column when the search column is a declared camelCase property', async () => {
      const manager = await seedManager();

      const rows = await manager.find(referralsTable, {
        search: { columns: ['affiliateCode'], value: 'ALPHA' },
      });

      expect(rows.map((row: any) => row.affiliateCode)).toEqual(['ALPHA123']);
    });

    it('does NOT match every row when the term is a substring of the column name', async () => {
      const manager = await seedManager();

      const rows = await manager.find(referralsTable, {
        search: { columns: ['affiliateCode'], value: 'ffil' },
      });

      expect(rows).toEqual([]);
    });

    it('snake_cases the identifier fallback for a column the table object does not declare', async () => {
      const manager = await seedManager();
      const partialTable = sqliteTable('fcp_test_referrals', { id: integer('id') });

      const rows = await manager.find(partialTable, {
        search: { columns: ['customerEmail'], value: 'gil@' },
      });

      expect(rows).toHaveLength(1);
    });

    it('does NOT match every row through the identifier fallback', async () => {
      const manager = await seedManager();
      const partialTable = sqliteTable('fcp_test_referrals', { id: integer('id') });

      const rows = await manager.find(partialTable, {
        search: { columns: ['customerEmail'], value: 'ustomerEmail' },
      });

      expect(rows).toEqual([]);
    });
  });
});
