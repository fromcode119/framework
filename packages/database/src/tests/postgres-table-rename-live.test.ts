import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';

/**
 * Renaming a table on a real Postgres carries its indexes, sequence, constraints and policies to the new
 * name. SKIPPED when no server is reachable: point `POSTGRES_TEST_URL` at a throwaway database.
 */
const url = process.env.POSTGRES_TEST_URL || '';
const OLD = 'fcp_rename_old_items';
const NEW = 'fcp_rename_new_items';

let db: PostgresDatabaseManager | null = null;

beforeAll(async () => {
  if (!url) return;
  try {
    db = new PostgresDatabaseManager(url);
    await db.queryRaw('SELECT 1');
  } catch {
    db = null;
    return;
  }
  for (const table of [OLD, NEW]) await db.queryRaw(`DROP TABLE IF EXISTS "${table}"`);
  await db.queryRaw(`CREATE TABLE "${OLD}" (id serial PRIMARY KEY, slug text, CONSTRAINT "${OLD}_slug_key" UNIQUE (slug))`);
  await db.queryRaw(`CREATE INDEX "${OLD}_slug_idx" ON "${OLD}" (slug)`);
  await db.queryRaw(`ALTER TABLE "${OLD}" ENABLE ROW LEVEL SECURITY`);
  await db.queryRaw(`CREATE POLICY "${OLD}_tenant_isolation" ON "${OLD}" USING (true)`);
  await db.queryRaw(`INSERT INTO "${OLD}" (slug) VALUES ('a'), ('b')`);
});

afterAll(async () => {
  if (db) for (const table of [OLD, NEW]) await db.queryRaw(`DROP TABLE IF EXISTS "${table}"`);
});

describe('Postgres renameTable (live)', () => {
  it('moves the rows and renames what is named after the table', async (ctx) => {
    if (!db) return ctx.skip();
    await db.renameTable(OLD, NEW);
    expect(await db.tableExists(OLD)).toBe(false);
    expect((await db.queryRaw(`SELECT slug FROM "${NEW}" ORDER BY id`)).map((row) => row.slug)).toEqual(['a', 'b']);
    const names = async (sql: string) => (await db!.queryRaw(sql, [NEW])).map((row) => String(row.name)).sort();
    expect(await names(`SELECT conname AS name FROM pg_constraint WHERE conrelid = $1::regclass`)).toEqual([`${NEW}_pkey`, `${NEW}_slug_key`]);
    expect(await names(`SELECT i.relname AS name FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid WHERE x.indrelid = $1::regclass`))
      .toEqual([`${NEW}_pkey`, `${NEW}_slug_idx`, `${NEW}_slug_key`]);
    expect(await names(`SELECT polname AS name FROM pg_policy WHERE polrelid = $1::regclass`)).toEqual([`${NEW}_tenant_isolation`]);
    expect(await names(`SELECT pg_get_serial_sequence($1, 'id') AS name`)).toEqual([`public.${NEW}_id_seq`]);
    // The sequence still serves the renamed column.
    await db.queryRaw(`INSERT INTO "${NEW}" (slug) VALUES ('c')`);
    expect((await db.queryRaw(`SELECT max(id) AS id FROM "${NEW}"`))[0].id).toBe(3);
  });
});
