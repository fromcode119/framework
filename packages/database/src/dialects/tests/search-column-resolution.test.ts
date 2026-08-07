import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';
import { UnknownColumnError } from '@database/dialects/unknown-column-error';

/**
 * These assert the GENERATED SQL, not just the row count.
 *
 * The whole bug class is invisible to a row-count assertion: on SQLite an unknown double-quoted
 * identifier is not an error, it degrades to a STRING LITERAL. `"affiliateCode" LIKE '%AFF%'` therefore
 * compares the literal text `affiliateCode` and matches EVERY row, while a term that is not a substring
 * of the column name matches NONE — a search that silently answers with the whole table or with nothing,
 * and a count assertion can agree with either by accident. Pinning the emitted identifier is the only
 * way to catch it.
 */
describe('search column resolution', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  /** Mirrors the real `fcp_mlm_referrals`: canonical camelCase fields, snake_case physical columns. */
  async function seedManager(): Promise<{ manager: SqliteDatabaseManager; statements: string[] }> {
    const dbPath = path.join(os.tmpdir(), `fromcode-search-resolution-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute(
      'CREATE TABLE "fcp_mlm_referrals" (' +
        '"id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        '"affiliate_code" TEXT, ' +
        '"order_number" TEXT, ' +
        '"customer_email" TEXT, ' +
        '"status" TEXT)'
    );
    await manager.insert('fcp_mlm_referrals', { affiliateCode: 'AFF-ALPHA', orderNumber: 'ORD-1', customerEmail: 'ann@example.com', status: 'paid' });
    await manager.insert('fcp_mlm_referrals', { affiliateCode: 'AFF-BETA', orderNumber: 'ORD-2', customerEmail: 'ben@example.com', status: 'paid' });
    await manager.insert('fcp_mlm_referrals', { affiliateCode: 'AFF-GAMMA', orderNumber: 'ORD-3', customerEmail: 'gil@example.com', status: 'pending' });

    // Record every statement the read path prepares, so the emitted identifier can be asserted.
    const statements: string[] = [];
    const sqlite: any = (manager as any).sqlite;
    const originalPrepare = sqlite.prepare.bind(sqlite);
    sqlite.prepare = (statement: string) => {
      statements.push(statement);
      return originalPrepare(statement);
    };

    return { manager, statements };
  }

  const searchSql = (statements: string[]): string =>
    statements.find((statement) => statement.includes('LIKE')) || '';

  describe('a camelCase search column reaches the snake_case physical column', () => {
    it('emits the physical column, never the canonical camelCase name', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_mlm_referrals', {
        search: { columns: ['affiliateCode'], value: 'ALPHA' },
      });

      expect(searchSql(statements)).toContain('"affiliate_code" LIKE ?');
      expect(searchSql(statements)).not.toContain('"affiliateCode"');
      expect(rows.map((row: any) => row.affiliate_code)).toEqual(['AFF-ALPHA']);
    });

    it('resolves every column of a multi-column search', async () => {
      const { manager, statements } = await seedManager();

      await manager.find('fcp_mlm_referrals', {
        search: { columns: ['affiliateCode', 'orderNumber', 'customerEmail'], value: 'ben@' },
      });

      expect(searchSql(statements)).toContain(
        '("affiliate_code" LIKE ? OR "order_number" LIKE ? OR "customer_email" LIKE ?)'
      );
    });

    it('leaves a column already given in snake_case alone', async () => {
      const { manager, statements } = await seedManager();

      await manager.find('fcp_mlm_referrals', {
        search: { columns: ['affiliate_code'], value: 'BETA' },
      });

      expect(searchSql(statements)).toContain('"affiliate_code" LIKE ?');
    });
  });

  describe('the unresolved-identifier hazard', () => {
    /**
     * Both failure modes of the SAME emitted SQL, which is why the guard is an assertion on the SQL and
     * not on a row count:
     *
     *  - this stack (better-sqlite3, SQLITE_DQS=0) REJECTS `"affiliateCode"` outright, so the old dialect
     *    turned every plugin search into a thrown "no such column";
     *  - a DQS-enabled SQLite build (the `sqlite3` CLI, and older embeddings) instead degrades the
     *    double-quoted name to a STRING LITERAL, and the predicate then compares the column NAME as
     *    text — matching EVERY row when the term is a substring of that name, and none otherwise.
     *
     * A row-count assertion cannot distinguish the second mode from a correct empty result, so the
     * emitted identifier is what is pinned.
     */
    it('is rejected by this runtime rather than silently matching', async () => {
      const { manager } = await seedManager();
      const sqlite: any = (manager as any).sqlite;

      expect(() =>
        sqlite.prepare(`SELECT COUNT(*) AS total FROM "fcp_mlm_referrals" WHERE "affiliateCode" LIKE '%ffil%'`)
      ).toThrow(/no such column/);
    });

    it('is what a DQS-enabled build would have compared: the column NAME as text, matching every row', async () => {
      const { manager } = await seedManager();
      const sqlite: any = (manager as any).sqlite;

      // Single quotes make the literal semantics explicit — this is exactly what a DQS build silently
      // does with the double-quoted identifier the dialect used to emit.
      const degraded = sqlite.prepare(`SELECT COUNT(*) AS total FROM "fcp_mlm_referrals" WHERE 'affiliateCode' LIKE '%ffil%'`).get();
      expect(degraded.total).toBe(3);

      // The real column matches nothing for that term — proving the 3 above are a naming artifact.
      const correct = sqlite.prepare(`SELECT COUNT(*) AS total FROM "fcp_mlm_referrals" WHERE "affiliate_code" LIKE '%ffil%'`).get();
      expect(correct.total).toBe(0);
    });

    it('never emits the unresolved identifier in the first place', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_mlm_referrals', {
        search: { columns: ['affiliateCode'], value: 'ffil' },
      });

      expect(searchSql(statements)).toContain('"affiliate_code" LIKE ?');
      expect(searchSql(statements)).not.toContain('affiliateCode');
      expect(rows).toEqual([]);
    });
  });

  describe('a malformed search option fails loudly instead of returning the whole table', () => {
    it('throws when search is a bare string rather than { columns, value }', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_mlm_referrals', { search: 'AFF' } as any)
      ).rejects.toThrow(/search option/i);
    });

    it('throws when columns is empty, rather than dropping the filter', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_mlm_referrals', { search: { columns: [], value: 'AFF' } })
      ).rejects.toThrow(/search option/i);
    });

    it('treats an empty term as "no search", which is how callers omit it', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_mlm_referrals', {
        search: { columns: ['affiliateCode'], value: '' },
      });

      expect(searchSql(statements)).toBe('');
      expect(rows).toHaveLength(3);
    });
  });

  describe('an unresolvable column fails loudly', () => {
    it('throws UnknownColumnError instead of silently matching', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_mlm_referrals', { search: { columns: ['totallyBogus'], value: 'ogus' } })
      ).rejects.toThrow(UnknownColumnError);
    });

    it('names the table and the offending column', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_mlm_referrals', { search: { columns: ['totallyBogus'], value: 'x' } })
      ).rejects.toThrow(/Unknown column "totallyBogus" on table "fcp_mlm_referrals"/);
    });

    it('never executes a LIKE against the unresolved name', async () => {
      const { manager, statements } = await seedManager();

      await manager
        .find('fcp_mlm_referrals', { search: { columns: ['totallyBogus'], value: 'ogus' } })
        .catch(() => undefined);

      expect(searchSql(statements)).toBe('');
    });

    it('rejects the whole search when only ONE of several columns is unresolvable', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_mlm_referrals', {
          search: { columns: ['affiliateCode', 'notAColumn'], value: 'AFF' },
        })
      ).rejects.toThrow(UnknownColumnError);
    });
  });

  describe('identifiers are validated, never interpolated', () => {
    it('rejects a search column carrying a quote instead of breaking out of the identifier', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_mlm_referrals', {
          search: { columns: ['affiliate_code" OR "1"="1'], value: 'x' },
        })
      ).rejects.toThrow(UnknownColumnError);
    });

    it('rejects an orderBy key that is not a plain identifier', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_mlm_referrals', { orderBy: { 'id" --': 'desc' } })
      ).rejects.toThrow(/Invalid column identifier/);
    });

    it('still orders by a normal camelCase key', async () => {
      const { manager, statements } = await seedManager();

      await manager.find('fcp_mlm_referrals', { orderBy: { orderNumber: 'desc' } });

      expect(statements.some((statement) => statement.includes('ORDER BY "order_number" DESC'))).toBe(true);
    });
  });

  describe('where keys keep resolving through the same path', () => {
    it('emits the physical column for a camelCase where key', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_mlm_referrals', { where: { customerEmail: 'gil@example.com' } });

      expect(statements.some((statement) => statement.includes('"customer_email" = ?'))).toBe(true);
      expect(rows).toHaveLength(1);
    });

    it('ANDs a resolved search with a resolved where', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_mlm_referrals', {
        where: { status: 'pending' },
        search: { columns: ['affiliateCode'], value: 'AFF' },
      });

      expect(searchSql(statements)).toContain('"status" = ? AND ("affiliate_code" LIKE ?)');
      expect(rows.map((row: any) => row.affiliate_code)).toEqual(['AFF-GAMMA']);
    });
  });
});
