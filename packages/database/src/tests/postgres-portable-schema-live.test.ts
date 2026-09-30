import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';
import { SortDirection } from '@database/enums/sort-direction.enum';

/**
 * The named schema operations plugin migrations use, against a real Postgres.
 *
 * The unit test proves the SQL text; only a server proves Postgres accepts it — that `"metadata"->'key'`
 * lands in a `jsonb` column, that a sort order is legal inside `CREATE INDEX`, that the drops are
 * repeat-safe. SKIPPED when no server is reachable: point `POSTGRES_TEST_URL` at a throwaway database
 * whose role may create tables, and these run.
 */
const url = process.env.POSTGRES_TEST_URL || '';
const TABLE = 'fcp_alpha_portable_schema_live';

const reachable = async (): Promise<PostgresDatabaseManager | null> => {
  if (!url) return null;
  try {
    const db = new PostgresDatabaseManager(url);
    await db.connect();
    await db.queryRaw('SELECT 1');
    return db;
  } catch {
    return null;
  }
};

let db: PostgresDatabaseManager | null = null;

beforeAll(async () => {
  db = await reachable();
  if (!db) return;
  await db.queryRaw(`DROP TABLE IF EXISTS "${TABLE}"`);
  await db.queryRaw(`CREATE TABLE "${TABLE}" (id serial PRIMARY KEY, metadata jsonb, sources jsonb, provider_key text, fulfillment_provider_key text)`);
  await db.queryRaw(
    `INSERT INTO "${TABLE}" (metadata, provider_key, fulfillment_provider_key, sources) VALUES `
    + `('{"sources":["feed","crm"]}', 'carrier_a', NULL, NULL), ('{}', 'x', 'kept', '["own"]'), (NULL, NULL, NULL, NULL)`,
  );
});

afterAll(async () => {
  if (db) await db.queryRaw(`DROP TABLE IF EXISTS "${TABLE}"`);
});

describe('Postgres portable schema operations (live)', () => {
  it('copies a JSON key and a column into the columns that replaced them, never over a value', async (ctx) => {
    if (!db) return ctx.skip();
    await db.copyColumnValues(TABLE, 'sources', 'metadata', 'sources');
    await db.copyColumnValues(TABLE, 'fulfillment_provider_key', 'provider_key');

    const rows = await db.queryRaw(`SELECT id, sources, fulfillment_provider_key FROM "${TABLE}" ORDER BY id`);
    expect(rows).toEqual([
      { id: 1, sources: ['feed', 'crm'], fulfillment_provider_key: 'carrier_a' },
      { id: 2, sources: ['own'], fulfillment_provider_key: 'kept' },
      { id: 3, sources: null, fulfillment_provider_key: null },
    ]);
  });

  it('creates an ordered unique index once, then drops a column and the table, repeatably', async (ctx) => {
    if (!db) return ctx.skip();
    await db.createIndexIfMissing(TABLE, 'idx_alpha_portable_fpk', ['fulfillment_provider_key', { name: 'id', order: SortDirection.DESC }], { unique: true });
    await db.createIndexIfMissing(TABLE, 'idx_alpha_portable_fpk', ['fulfillment_provider_key']);
    const indexes = await db.queryRaw(`SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_alpha_portable_fpk'`);
    expect(indexes).toHaveLength(1);
    expect(String(indexes[0].indexdef)).toMatch(/UNIQUE INDEX .* \(fulfillment_provider_key, id DESC\)/);

    await db.dropColumnIfExists(TABLE, 'provider_key');
    await db.dropColumnIfExists(TABLE, 'provider_key');
    expect(await db.getColumns(TABLE)).not.toContain('provider_key');

    await db.dropTableIfExists(TABLE);
    await db.dropTableIfExists(TABLE);
    expect(await db.tableExists(TABLE)).toBe(false);
  });
});
