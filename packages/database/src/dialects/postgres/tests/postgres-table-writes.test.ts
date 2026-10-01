import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, serial, text, integer, numeric, boolean, timestamp, date, jsonb, uuid } from 'drizzle-orm/pg-core';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { PostgresTableWrites } from '@database/dialects/postgres/postgres-table-writes';

/**
 * Writes on a typed table are assembled by our own query layer, not Drizzle's builders. The statement
 * sent must be Drizzle's — same columns, same order, `default` where absent, each value encoded by its
 * own column — and the rows written and returned must be identical.
 */

const columnsOf = () => ({
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title'),
  stock: integer('stock').default(0),
  price: numeric('price'),
  isActive: boolean('is_active').notNull().default(false),
  tags: jsonb('tags').default([]),
  releaseDay: date('release_day'),
  ref: uuid('ref').defaultRandom(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
const own = pgTable('write_equiv_own', columnsOf());
const twin = pgTable('write_equiv_drizzle', columnsOf());

/**
 * A real manager whose pool is the given one — the real write and read methods, nothing stubbed but the
 * column normalizer (string tables only) — and never the manager's own connection.
 */
function manager(pool: any): any {
  const db: any = new PostgresDatabaseManager('postgres://unused@127.0.0.1:1/unused');
  const normalizer = { normalizeWhereForTable: async (_t: string, w: unknown) => w, normalizeColumnValueForWrite: async (_t: string, _c: string, v: unknown) => v };
  db.pool = pool;
  db.drizzle = drizzle(pool);
  db.normalizer = normalizer;
  db.reader = new PostgresReadOperations(pool, db.drizzle, normalizer as any, db.like);
  return db;
}

const env = process.env.DB_WRITE_PATH;
afterEach(() => {
  if (env === undefined) delete process.env.DB_WRITE_PATH; else process.env.DB_WRITE_PATH = env;
  vi.restoreAllMocks();
});

/** Every write shape the framework's services issue against a typed table. */
const writes: Array<[string, (db: any, table: any) => Promise<unknown>]> = [
  ['insert, every value', (db, t) => db.insert(t, { slug: 'lamp', title: 'Lamp', stock: 4, price: '19.90', isActive: true, tags: ['a', 'b'], releaseDay: '2026-03-01', publishedAt: new Date('2026-03-01T10:15:30.123Z') })],
  ['insert, defaults for the rest', (db, t) => db.insert(t, { slug: 'chair' })],
  ['insert, an explicit null and an unknown key', (db, t) => db.insert(t, { slug: 'желязо', title: null, notAColumn: 'ignored' })],
  ['update by id', (db, t) => db.update(t, { id: 1 }, { title: 'Lamp (edited)', stock: 5, tags: { nested: { x: [1, 2] } } })],
  ['update by a range, skipping an undefined value', (db, t) => db.update(t, { stock: { gte: 0, lte: 1 } }, { isActive: true, title: undefined })],
  ['update by a SQL fragment', (db, t) => db.update(t, eq(t.slug, 'chair'), { price: '100000000000.000001' })],
  ['update with a SQL value', (db, t) => db.update(t, { slug: 'lamp' }, { stock: sql`${t.stock} + 1` })],
  ['upsert, conflict', (db, t) => db.upsert(t, { slug: 'lamp', title: 'Lamp v2' }, { target: 'slug', set: { title: 'Lamp v2' } })],
  ['upsert, new row', (db, t) => db.upsert(t, { slug: 'table', stock: 7 }, { target: 'slug', set: { stock: 7 } })],
  ['delete by a set', (db, t) => db.delete(t, { slug: { in: ['table', 'nothing'] } })],
  ['delete nothing', (db, t) => db.delete(t, { id: 999 })],
];

describe('own typed-table writes: the statement', () => {
  const recordingPool = () => {
    const sent: Array<{ text: string; params: unknown[] }> = [];
    const query = vi.fn(async (config: any, values?: unknown[]) => {
      sent.push({ text: typeof config === 'string' ? config : config.text, params: values ?? [] });
      return { rows: [], rowCount: 0, fields: [] };
    });
    return { pool: { query, connect: async () => ({ query, release() {} }) }, sent };
  };

  const sentBy = async (mode: string, run: (db: any, table: any) => Promise<unknown>) => {
    process.env.DB_WRITE_PATH = mode;
    const { pool, sent } = recordingPool();
    await run(manager(pool), own);
    return sent;
  };

  for (const [name, run] of writes) {
    it(`${name}: the same text and parameters as Drizzle's builder`, async () => {
      const ours = await sentBy('own', run);
      expect(ours).toHaveLength(1);
      expect(ours).toEqual(await sentBy('drizzle', run));
    });
  }

  it('takes our own path for every write — the comparison above is not Drizzle against itself', async () => {
    process.env.DB_WRITE_PATH = 'own';
    const ran = vi.spyOn(PostgresTableWrites.prototype, 'run');
    const { pool } = recordingPool();
    const db = manager(pool);
    const builders = ['insert', 'update', 'delete'].map((method) => vi.spyOn(db.drizzle, method));
    for (const [, run] of writes) await run(db, own);
    expect(ran).toHaveBeenCalledTimes(writes.length);
    for (const builder of builders) expect(builder).not.toHaveBeenCalled();
  });

  it('refuses an update with no filter — it used to rewrite every row', async () => {
    process.env.DB_WRITE_PATH = 'own';
    const { pool, sent } = recordingPool();
    await expect(manager(pool).update(own, {}, { title: 'x' })).rejects.toThrow('Unsafe update blocked');
    process.env.DB_WRITE_PATH = 'drizzle';
    await expect(manager(pool).update(own, {}, { title: 'x' })).rejects.toThrow('Unsafe update blocked');
    expect(sent).toEqual([]);
  });

  it('refuses a write with nothing to set, as Drizzle does', async () => {
    process.env.DB_WRITE_PATH = 'own';
    const { pool } = recordingPool();
    await expect(manager(pool).update(own, { id: 1 }, { title: undefined })).rejects.toThrow('No values to set');
  });

  it('under shadow, compares the statements and runs only Drizzle\'s — never both', async () => {
    process.env.DB_WRITE_PATH = 'shadow';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { pool, sent } = recordingPool();
    for (const [, run] of writes) await run(manager(pool), own);
    expect(sent).toHaveLength(writes.length);
    expect(warn.mock.calls.filter((call) => String(call[0]).includes('[db-read-shadow]'))).toEqual([]);
  });
});

/**
 * Against a REAL Postgres: the same writes through each path, on twin tables, must answer the same and
 * leave the same rows. SKIPS without `DB_READ_TEST_DATABASE_URL` — a THROWAWAY database.
 */
const url = process.env.DB_READ_TEST_DATABASE_URL;

describe.skipIf(!url)('own typed-table writes: the rows (real Postgres)', () => {
  let pool: Pool;
  const ddl = (name: string) => `CREATE TABLE ${name} (
    id serial PRIMARY KEY, slug text NOT NULL UNIQUE, title text, stock integer DEFAULT 0, price numeric,
    is_active boolean NOT NULL DEFAULT false, tags jsonb DEFAULT '[]', release_day date,
    ref uuid DEFAULT gen_random_uuid(), published_at timestamptz, created_at timestamptz DEFAULT now())`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 2 });
    for (const name of ['write_equiv_own', 'write_equiv_drizzle']) {
      await pool.query(`DROP TABLE IF EXISTS ${name}`);
      await pool.query(ddl(name));
    }
  });

  afterAll(async () => {
    for (const name of ['write_equiv_own', 'write_equiv_drizzle']) await pool.query(`DROP TABLE IF EXISTS ${name}`);
    await pool.end();
  });

  /** Generated per row (random uuid, now()): present and well-typed on both, never equal across tables. */
  const comparable = (value: any): any => {
    if (Array.isArray(value)) return value.map(comparable);
    if (!value || typeof value !== 'object') return value;
    expect(typeof value.ref).toBe('string');
    expect(value.createdAt).toBeInstanceOf(Date);
    const { ref: _ref, createdAt: _createdAt, ...rest } = value;
    return rest;
  };

  it('every write answers the same, and leaves the same rows', async () => {
    const db = manager(pool);
    for (const [name, run] of writes) {
      process.env.DB_WRITE_PATH = 'own';
      const ours = await run(db, own);
      process.env.DB_WRITE_PATH = 'drizzle';
      const theirs = await run(db, twin);
      expect(comparable(ours), name).toStrictEqual(comparable(theirs));
    }
    const rows = async (table: any) => comparable(await db.find(table, { orderBy: { id: 'asc' } }));
    expect(await rows(own)).toStrictEqual(await rows(twin));
  });

  it('wrote what was asked — not merely the same wrong thing twice', async () => {
    const lamp = await manager(pool).findOne(own, { slug: 'lamp' });
    expect(lamp).toMatchObject({ title: 'Lamp v2', stock: 6, price: '19.90', isActive: true, tags: { nested: { x: [1, 2] } }, releaseDay: '2026-03-01' });
    expect(lamp.publishedAt.toISOString()).toBe('2026-03-01T10:15:30.123Z');
    expect(await manager(pool).findOne(own, { slug: 'chair' })).toMatchObject({ price: '100000000000.000001', stock: 0, isActive: true });
    expect(await manager(pool).findOne(own, { slug: 'table' })).toBeNull();
  });
});
