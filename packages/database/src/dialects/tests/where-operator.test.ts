import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { PostgresColumnNormalizer } from '@database/dialects/postgres/column-normalizer';
import { WhereClauseParser } from '@database/dialects/where-clause-parser';

/**
 * `where` used to support ONLY equality, so a date range could not be expressed at all. The analytics
 * export wrote `where: { created_at: { gte, lte } }`; the object was JSON-stringified and compared with
 * `=`, matching nothing, and the CSV came back EMPTY — indistinguishable from "no data".
 *
 * These assert the generated SQL for each operator on both dialects, because Postgres and SQLite differ
 * in placeholder style ($1 vs ?) and that is exactly the kind of difference SQLite hides.
 */
describe('where operators', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  async function seedManager(): Promise<{ manager: SqliteDatabaseManager; statements: string[] }> {
    const dbPath = path.join(os.tmpdir(), `fromcode-where-operator-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);

    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute(
      'CREATE TABLE "fcp_analytics_events" (' +
        '"id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        '"created_at" TEXT, ' +
        '"event_type" TEXT, ' +
        '"metadata" JSON)'
    );
    await manager.insert('fcp_analytics_events', { createdAt: '2026-01-05', eventType: 'pageview', metadata: { a: 1 } });
    await manager.insert('fcp_analytics_events', { createdAt: '2026-02-10', eventType: 'pageview', metadata: { a: 2 } });
    await manager.insert('fcp_analytics_events', { createdAt: '2026-03-20', eventType: 'click', metadata: { a: 3 } });

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

  describe('SQLite', () => {
    it('emits a bounded range for { gte, lte } and returns only the rows inside it', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_analytics_events', {
        where: { createdAt: { gte: '2026-01-01', lte: '2026-02-28' } },
      });

      expect(whereSql(statements)).toContain('"created_at" >= ? AND "created_at" <= ?');
      expect(rows.map((row: any) => row.created_at)).toEqual(['2026-01-05', '2026-02-10']);
    });

    it('emits each comparison operator', async () => {
      const cases: Array<[string, string]> = [
        ['gt', '>'], ['gte', '>='], ['lt', '<'], ['lte', '<='], ['ne', '<>'], ['eq', '='],
      ];

      for (const [operator, sqlOperator] of cases) {
        const { manager, statements } = await seedManager();
        await manager.find('fcp_analytics_events', { where: { createdAt: { [operator]: '2026-02-01' } } });
        expect(whereSql(statements)).toContain(`"created_at" ${sqlOperator} ?`);
      }
    });

    it('ANDs a range with an equality on another column', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_analytics_events', {
        where: { eventType: 'pageview', createdAt: { gte: '2026-02-01' } },
      });

      expect(whereSql(statements)).toContain('"event_type" = ? AND "created_at" >= ?');
      expect(rows).toHaveLength(1);
    });

    it('combines a range with a resolved search', async () => {
      const { manager, statements } = await seedManager();

      await manager.find('fcp_analytics_events', {
        where: { createdAt: { gte: '2026-01-01' } },
        search: { columns: ['eventType'], value: 'click' },
      });

      expect(whereSql(statements)).toContain('"created_at" >= ? AND ("event_type" LIKE ?)');
    });

    it('still treats a JSON literal object as equality, not as operators', async () => {
      const { manager, statements } = await seedManager();

      const rows = await manager.find('fcp_analytics_events', { where: { metadata: { a: 2 } } });

      expect(whereSql(statements)).toContain('"metadata" = ?');
      expect(rows).toHaveLength(1);
    });

    it('does not stringify the operator object into an equality', async () => {
      const { manager, statements } = await seedManager();

      await manager.find('fcp_analytics_events', { where: { createdAt: { gte: '2026-01-01' } } });

      expect(whereSql(statements)).not.toContain('"created_at" = ?');
    });
  });

  describe('Postgres', () => {
    /** Exposes the protected builders; the pool is never used because no query is executed. */
    class ProbePostgresReadOperations extends PostgresReadOperations {
      buildWhere(where: any, search?: any) {
        return this.buildRawFilterSQL(where, search);
      }
    }

    const probe = (): ProbePostgresReadOperations =>
      new ProbePostgresReadOperations(
        {} as any,
        {} as any,
        new PostgresColumnNormalizer({} as any),
        (() => undefined) as any
      );

    it('numbers placeholders positionally across a range', () => {
      const { sql, values } = probe().buildWhere({ createdAt: { gte: '2026-01-01', lte: '2026-02-28' } });

      expect(sql).toBe(' WHERE "created_at" >= $1 AND "created_at" <= $2');
      expect(values).toEqual(['2026-01-01', '2026-02-28']);
    });

    it('keeps placeholder numbering correct when a range is followed by a search', () => {
      const { sql, values } = probe().buildWhere(
        { createdAt: { gte: '2026-01-01', lte: '2026-02-28' } },
        { columns: ['event_type'], value: 'click' }
      );

      expect(sql).toBe(' WHERE "created_at" >= $1 AND "created_at" <= $2 AND ("event_type" ILIKE $3)');
      expect(values).toEqual(['2026-01-01', '2026-02-28', '%click%']);
    });

    it('snake_cases the operator column exactly like an equality column', () => {
      const { sql } = probe().buildWhere({ eventType: 'click', createdAt: { gte: '2026-01-01' } });

      expect(sql).toBe(' WHERE "event_type" = $1 AND "created_at" >= $2');
    });

    it('emits each comparison operator', () => {
      for (const [operator, sqlOperator] of [['gt', '>'], ['gte', '>='], ['lt', '<'], ['lte', '<='], ['ne', '<>'], ['eq', '=']]) {
        const { sql } = probe().buildWhere({ createdAt: { [operator]: 'x' } });
        expect(sql).toBe(` WHERE "created_at" ${sqlOperator} $1`);
      }
    });
  });

  describe('an unsupported or ambiguous operator raises', () => {
    it('rejects an object mixing operators with non-operator keys', () => {
      expect(() => WhereClauseParser.parse({ createdAt: { gte: 'x', ltee: 'y' } }))
        .toThrow(/mixes operators/);
    });

    it('names both the operator and the unknown key', () => {
      expect(() => WhereClauseParser.parse({ createdAt: { gte: 'x', ltee: 'y' } }))
        .toThrow(/gte.*ltee|ltee.*gte/s);
    });

    it('raises through find rather than returning unfiltered rows', async () => {
      const { manager } = await seedManager();

      await expect(
        manager.find('fcp_analytics_events', { where: { createdAt: { gte: '2026-01-01', bogus: 'y' } } })
      ).rejects.toThrow(/mixes operators/);
    });

    it('treats an object with no operator keys as a literal, unchanged', () => {
      const comparisons = WhereClauseParser.parse({ metadata: { a: 1, b: 2 } });

      expect(comparisons).toHaveLength(1);
      expect(comparisons[0].operator).toBe('eq');
      expect(comparisons[0].value).toEqual({ a: 1, b: 2 });
    });
  });

  describe('count applies the same operators', () => {
    it('counts only the rows inside the range', async () => {
      const { manager } = await seedManager();

      const total = await manager.count('fcp_analytics_events', {
        where: { createdAt: { gte: '2026-01-01', lte: '2026-02-28' } },
      });

      expect(total).toBe(2);
    });

    it('does not count the whole table when a range is given', async () => {
      const { manager } = await seedManager();

      const total = await manager.count('fcp_analytics_events', { where: { createdAt: { gte: '2026-03-01' } } });

      expect(total).toBe(1);
    });
  });
});
