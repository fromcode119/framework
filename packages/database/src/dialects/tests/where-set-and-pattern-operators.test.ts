import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { PostgresColumnNormalizer } from '@database/dialects/postgres/column-normalizer';

/**
 * `where` supported only ONE operand per operator, so "any of these statuses" and "name contains" could
 * not be expressed in SQL at all. Callers answered that by fetching rows under a limit and filtering
 * them in JavaScript — slower, and silently WRONG the moment the table outgrew the limit, because the
 * rows that would have matched were never fetched. The Hub listing service was doing exactly that.
 *
 * These assert the emitted SQL on both dialects AND run it, because the parts most likely to be wrong —
 * placeholder numbering across a variable-length list, and whether SQLite/Postgres accept the ESCAPE
 * clause at all — do not show up in a string comparison.
 */
describe('set and pattern where operators', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) fs.rmSync(filePath, { force: true });
  });

  async function seedManager(): Promise<{ manager: SqliteDatabaseManager; statements: string[] }> {
    const dbPath = path.join(os.tmpdir(), `fromcode-where-set-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute(
      'CREATE TABLE "fcp_hub_candidates" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "full_name" TEXT, "status" TEXT)'
    );
    await manager.insert('fcp_hub_candidates', { fullName: 'Ann Petrova', status: 'INTERVIEW' });
    await manager.insert('fcp_hub_candidates', { fullName: 'Boris Ivanov', status: 'OFFER' });
    await manager.insert('fcp_hub_candidates', { fullName: 'Clara Nash', status: 'REJECTED' });
    await manager.insert('fcp_hub_candidates', { fullName: '100% Match', status: 'NEW' });

    const statements: string[] = [];
    const sqlite: any = (manager as any).sqlite;
    const originalPrepare = sqlite.prepare.bind(sqlite);
    sqlite.prepare = (statement: string) => {
      statements.push(statement);
      return originalPrepare(statement);
    };

    return { manager, statements };
  }

  const whereSql = (statements: string[]): string =>
    statements.find((statement) => statement.includes('WHERE')) || '';

  const names = (rows: any[]): string[] => rows.map((row: any) => row.full_name).sort();

  describe('SQLite, running the query it built', () => {
    it('matches any value in the set with one placeholder per element', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_hub_candidates', {
        where: { status: { in: ['INTERVIEW', 'OFFER'] } },
      });

      expect(whereSql(statements)).toContain('"status" IN (?, ?)');
      expect(names(rows)).toEqual(['Ann Petrova', 'Boris Ivanov']);
    });

    it('excludes every value in the set for notIn', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_hub_candidates', {
        where: { status: { notIn: ['REJECTED', 'NEW'] } },
      });

      expect(whereSql(statements)).toContain('"status" NOT IN (?, ?)');
      expect(names(rows)).toEqual(['Ann Petrova', 'Boris Ivanov']);
    });

    it('keeps placeholder numbering correct when a set is followed by another predicate', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_hub_candidates', {
        where: { status: { in: ['INTERVIEW', 'OFFER'] }, fullName: 'Boris Ivanov' },
      });

      expect(whereSql(statements)).toContain('"status" IN (?, ?) AND "full_name" = ?');
      expect(names(rows)).toEqual(['Boris Ivanov']);
    });

    it('matches nothing for an empty in, and everything for an empty notIn', async () => {
      const empty = await seedManager();
      const noneRows = await empty.manager.find('fcp_hub_candidates', { where: { status: { in: [] } } });
      expect(whereSql(empty.statements)).toContain('1 = 0');
      expect(noneRows).toHaveLength(0);

      const all = await seedManager();
      const allRows = await all.manager.find('fcp_hub_candidates', { where: { status: { notIn: [] } } });
      expect(whereSql(all.statements)).toContain('1 = 1');
      expect(allRows).toHaveLength(4);
    });

    it('matches a substring, a prefix and a suffix', async () => {
      const contains = await seedManager();
      const containsRows = await contains.manager.find('fcp_hub_candidates', { where: { fullName: { contains: 'ris Iva' } } });
      expect(whereSql(contains.statements)).toContain(`"full_name" LIKE ? ESCAPE '!'`);
      expect(names(containsRows)).toEqual(['Boris Ivanov']);

      const starts = await seedManager();
      expect(names(await starts.manager.find('fcp_hub_candidates', { where: { fullName: { startsWith: 'Ann' } } })))
        .toEqual(['Ann Petrova']);

      const ends = await seedManager();
      expect(names(await ends.manager.find('fcp_hub_candidates', { where: { fullName: { endsWith: 'Nash' } } })))
        .toEqual(['Clara Nash']);
    });

    it('treats a wildcard the user typed as a literal character', async () => {
      const { manager } = await seedManager();

      // Without escaping, `%` is "anything" and this would return all four rows.
      const rows = await manager.find('fcp_hub_candidates', { where: { fullName: { contains: '100%' } } });

      expect(names(rows)).toEqual(['100% Match']);
    });

    it('counts through the same operators', async () => {
      const { manager } = await seedManager();

      expect(await manager.count('fcp_hub_candidates', { where: { status: { in: ['INTERVIEW', 'OFFER'] } } })).toBe(2);
      expect(await manager.count('fcp_hub_candidates', { where: { fullName: { contains: 'a' } } })).toBe(4);
    });

    it('counts the SEARCHED rows, not the whole table', async () => {
      const { manager } = await seedManager();

      // `count` used to accept only `where`, so a searched list was captioned with the unsearched
      // total — "1 of 4" under a list of one, with nothing to show the caption was wrong.
      const search = { columns: ['fullName'], value: 'Ivanov' };
      const rows = await manager.find('fcp_hub_candidates', { search });

      expect(rows).toHaveLength(1);
      expect(await manager.count('fcp_hub_candidates', { search })).toBe(1);
    });

    it('counts a search combined with a where the same way find filters it', async () => {
      const { manager } = await seedManager();

      const options = { where: { status: { in: ['OFFER', 'REJECTED'] } }, search: { columns: ['fullName'], value: 'a' } };

      expect(await manager.count('fcp_hub_candidates', options))
        .toBe((await manager.find('fcp_hub_candidates', options)).length);
    });

    it('treats a wildcard typed into the search box as a literal', async () => {
      const { manager } = await seedManager();

      // Unescaped, `%` is "anything" and this returned the whole table. Escaped it means the
      // character itself, so it finds the one row whose name actually contains a per-cent sign.
      expect(await manager.count('fcp_hub_candidates', { search: { columns: ['fullName'], value: '%' } })).toBe(1);
      expect(await manager.count('fcp_hub_candidates', { search: { columns: ['fullName'], value: '100%' } })).toBe(1);
    });
  });

  describe('Postgres SQL shape', () => {
    /** Exposes the protected builder; the pool is never used because no query is executed. */
    class ProbePostgresReadOperations extends PostgresReadOperations {
      buildWhere(where: any, search?: any) {
        return this.buildRawFilterSQL(where, search);
      }
    }

    const probe = (): ProbePostgresReadOperations =>
      new ProbePostgresReadOperations({} as any, {} as any, new PostgresColumnNormalizer({} as any), (() => undefined) as any);

    it('numbers a set positionally and continues numbering after it', () => {
      const { sql, values } = probe().buildWhere({ status: { in: ['A', 'B', 'C'] }, fullName: 'x' });

      expect(sql).toBe(' WHERE "status" IN ($1, $2, $3) AND "full_name" = $4');
      expect(values).toEqual(['A', 'B', 'C', 'x']);
    });

    it('uses the case-insensitive operator Postgres has, and carries the escape clause', () => {
      const { sql, values } = probe().buildWhere({ fullName: { contains: 'ann' } });

      // The cast is what lets the same operator search a JSON column: Postgres has no
      // `jsonb LIKE text`, and on a text column the cast is a no-op relabel.
      expect(sql).toBe(` WHERE "full_name"::text ILIKE $1 ESCAPE '!'`);
      expect(values).toEqual(['%ann%']);
    });

    it('parameterises every operand — no caller value reaches the SQL string', () => {
      const injection = "x'); DROP TABLE fcp_hub_candidates; --";
      const { sql, values } = probe().buildWhere({ status: { in: [injection] }, fullName: { contains: injection } });

      expect(sql).not.toContain('DROP TABLE');
      expect(values[0]).toBe(injection);
    });
  });

  describe('an operand that cannot mean what it says raises', () => {
    it('refuses a null inside a set rather than silently matching nothing', async () => {
      const { manager } = await seedManager();

      await expect(manager.find('fcp_hub_candidates', { where: { status: { in: ['NEW', null] } } }))
        .rejects.toThrow(/cannot contain null/);
    });

    it('refuses a null pattern', async () => {
      const { manager } = await seedManager();

      await expect(manager.find('fcp_hub_candidates', { where: { fullName: { contains: null } } }))
        .rejects.toThrow(/cannot take null/);
    });
  });
});
