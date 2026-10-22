import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';
import { PortableSchemaOperations } from '@database/dialects/portable-schema-operations';
import { SortDirection } from '@database/enums/sort-direction.enum';

/** The schema statements plugin migrations used to hand-write, run for real on SQLite and checked as SQL. */
describe('PortableSchemaOperations', () => {
  const dbPaths: string[] = [];
  afterEach(() => {
    for (const filePath of dbPaths.splice(0)) fs.rmSync(filePath, { force: true });
  });

  const sqlite = async () => {
    const dbPath = path.join(os.tmpdir(), `fromcode-portable-schema-${Date.now()}-${Math.random()}.db`);
    dbPaths.push(dbPath);
    const manager = new SqliteDatabaseManager(dbPath);
    await manager.execute('CREATE TABLE "fcp_shop_items" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "metadata" TEXT, "old_key" TEXT, "new_key" TEXT, "sources" TEXT)');
    return manager;
  };

  it('copies a column, and a JSON key, into the column that replaced it — never over a value', async () => {
    const db = await sqlite();
    await db.execute(`INSERT INTO "fcp_shop_items" ("metadata", "old_key", "new_key") VALUES ('{"sources":"feed"}', 'a', NULL), ('{}', 'b', 'kept')`);

    await db.copyColumnValues('fcp_shop_items', 'new_key', 'old_key');
    await db.copyColumnValues('fcp_shop_items', 'sources', 'metadata', 'sources');

    const rows = await db.queryRaw('SELECT "new_key", "sources" FROM "fcp_shop_items" ORDER BY "id"');
    expect(rows).toEqual([{ new_key: 'a', sources: 'feed' }, { new_key: 'kept', sources: null }]);
  });

  it('creates an index once, drops a column and a table, and is repeat-safe', async () => {
    const db = await sqlite();
    await db.createIndexIfMissing('fcp_shop_items', 'idx_items_new', ['new_key', { name: 'id', order: SortDirection.DESC }], { unique: true });
    await db.createIndexIfMissing('fcp_shop_items', 'idx_items_new', ['new_key']);
    const indexes = await db.queryRaw(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_items_new'`);
    expect(indexes).toHaveLength(1);

    await db.dropColumnIfExists('fcp_shop_items', 'old_key');
    await db.dropColumnIfExists('fcp_shop_items', 'old_key');
    expect(await db.getColumns('fcp_shop_items')).not.toContain('old_key');

    await db.dropTableIfExists('fcp_shop_items');
    await db.dropTableIfExists('fcp_shop_items');
    expect(await db.tableExists('fcp_shop_items')).toBe(false);
  });

  it('reads a JSON key the way the driver says — Postgres uses ->', async () => {
    const issued: string[] = [];
    const ops = new PortableSchemaOperations(async (statement) => { issued.push(statement); }, (column, key) => `${column}->'${key}'`);
    await ops.copyColumnValues('fcp_shop_items', 'sources', 'metadata', 'sources');
    expect(issued[0]).toBe(`UPDATE "fcp_shop_items" SET "sources" = "metadata"->'sources' WHERE "sources" IS NULL AND "metadata"->'sources' IS NOT NULL`);
  });

  it('refuses any name that is not a plain identifier, before issuing anything', async () => {
    const issued: string[] = [];
    const ops = new PortableSchemaOperations(async (statement) => { issued.push(statement); });
    await expect(ops.dropTableIfExists('users"; DROP TABLE "x')).rejects.toThrow(/unsafe SQL identifier/);
    await expect(ops.copyColumnValues('fcp_shop_items', 'sources', 'metadata', "x') OR 1=1 --")).rejects.toThrow(/unsafe SQL identifier/);
    await expect(ops.createIndexIfMissing('fcp_shop_items', 'idx', [])).rejects.toThrow(/no columns/);
    expect(issued).toEqual([]);
  });

  it('renders a partial index predicate from checked identifiers and escaped literals', async () => {
    const issued: string[] = [];
    const ops = new PortableSchemaOperations(async (statement) => { issued.push(statement); });
    await ops.createIndexIfMissing('fcp_a_visits', 'idx_open', ['visitor_hash'], {
      unique: true,
      where: [
        { column: 'ended_at', value: null },
        { column: 'kind', value: "o'brien", negate: true },
        { column: 'tries', value: 3 },
        { column: 'live', value: true },
        { column: 'closed_by', value: null, negate: true },
      ],
    });
    expect(issued).toEqual([
      'CREATE UNIQUE INDEX IF NOT EXISTS "idx_open" ON "fcp_a_visits" ("visitor_hash") '
      + 'WHERE "ended_at" IS NULL AND "kind" <> \'o\'\'brien\' AND "tries" = 3 AND "live" = TRUE AND "closed_by" IS NOT NULL',
    ]);
    await expect(ops.createIndexIfMissing('t', 'i', ['a'], { where: [{ column: 'a"; DROP', value: 1 }] })).rejects.toThrow(/unsafe SQL identifier/);
    await expect(ops.createIndexIfMissing('t', 'i', ['a'], { where: [{ column: 'a', value: Number.NaN }] })).rejects.toThrow(/non-finite/);
  });

  it('builds a partial unique index on SQLite that enforces only the rows it covers', async () => {
    const db = await sqlite();
    await db.createIndexIfMissing('fcp_shop_items', 'idx_items_partial', ['new_key'], { unique: true, where: [{ column: 'old_key', value: null }] });
    await db.execute(`INSERT INTO fcp_shop_items (new_key, old_key) VALUES ('k', 'x'), ('k', 'y'), ('z', NULL)`);
    await expect(db.execute(`INSERT INTO fcp_shop_items (new_key, old_key) VALUES ('z', NULL)`)).rejects.toThrow(/UNIQUE/i);
  });
});
