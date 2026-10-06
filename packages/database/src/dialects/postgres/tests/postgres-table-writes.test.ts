import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { Sql } from '@database/sql/sql';
import { SqlColumns as c } from '@database/sql/sql-columns';
import { SqlTable } from '@database/sql/sql-table';

/**
 * Writes on a declared table are ours. Each write sends one statement (same columns, same order,
 * `default` where absent, each value encoded by its own column), pinned in the snapshot beside this file
 * and, against a real Postgres, writes and answers the rows pinned there too. The snapshots were written
 * when the same cases still matched the query library this layer replaced.
 */

const ourColumns = () => ({
  id: c.serial('id').primaryKey(), slug: c.text('slug').notNull().unique(), title: c.text('title'), stock: c.integer('stock').default(0),
  price: c.numeric('price'), isActive: c.boolean('is_active').notNull().default(false), tags: c.jsonb('tags').default([]),
  releaseDay: c.date('release_day'), ref: c.uuid('ref').defaultRandom(), publishedAt: c.timestamp('published_at', { withTimezone: true }),
  createdAt: c.timestamp('created_at', { withTimezone: true }).defaultNow(),
});
/** A real manager whose pool is the given one — its real write and read methods, nothing stubbed. */
function manager(pool: any): any {
  const db: any = new PostgresDatabaseManager('postgres://unused@127.0.0.1:1/unused');
  const normalizer = { normalizeWhereForTable: async (_t: string, w: unknown) => w, normalizeColumnValueForWrite: async (_t: string, _c: string, v: unknown) => v };
  db.pool = pool;
  db.normalizer = normalizer;
  db.reader = new PostgresReadOperations(pool, normalizer as any, db.like);
  return db;
}

const at = new Date('2026-03-01T10:15:30.123Z');

/** [name, the framework's call on our table]. */
const writes: Array<[string, (db: any, t: any) => Promise<unknown>]> = [
  ['insert, every value',
    (db, t) => db.insert(t, { slug: 'lamp', title: 'Lamp', stock: 4, price: '19.90', isActive: true, tags: ['a', 'b'], releaseDay: '2026-03-01', publishedAt: at })],
  ['insert, defaults for the rest', (db, t) => db.insert(t, { slug: 'chair' })],
  ['insert, an explicit null and an unknown key',
    (db, t) => db.insert(t, { slug: 'желязо', title: null, notAColumn: 'ignored' })],
  ['insert, several rows',
    (db, t) => db.insert(t, [{ slug: 'desk', stock: 2 }, { slug: 'shelf', title: 'Shelf' }])],
  ['update by id',
    (db, t) => db.update(t, { id: 1 }, { title: 'Lamp (edited)', stock: 5, tags: { nested: { x: [1, 2] } } })],
  ['update by a range, skipping an undefined value',
    (db, t) => db.update(t, { stock: { gte: 0, lte: 1 } }, { isActive: true, title: undefined })],
  ['update by a SQL fragment',
    (db, t) => db.update(t, Sql.eq(t.slug, 'chair'), { price: '100000000000.000001' })],
  ['update with a SQL value',
    (db, t) => db.update(t, { slug: 'lamp' }, { stock: Sql.query`${t.stock} + 1` })],
  ['upsert, conflict',
    (db, t) => db.upsert(t, { slug: 'lamp', title: 'Lamp v2' }, { target: 'slug', set: { title: 'Lamp v2' } })],
  ['upsert, new row',
    (db, t) => db.upsert(t, { slug: 'table', stock: 7 }, { target: 'slug', set: { stock: 7 } })],
  ['delete by a set', (db, t) => db.delete(t, { slug: { in: ['table', 'nothing'] } })],
  ['delete nothing', (db, t) => db.delete(t, { id: 999 })],
];

describe('our declared-table writes: the statement', () => {
  const ours = SqlTable.define('write_equiv', ourColumns());
  const recordingPool = () => {
    const sent: Array<{ text: string; params: unknown[] }> = [];
    const query = vi.fn(async (config: any, values?: unknown[]) => {
      sent.push({ text: typeof config === 'string' ? config : config.text, params: values ?? [] });
      return { rows: [], rowCount: 0, fields: [] };
    });
    return { pool: { query }, sent };
  };

  for (const [name, run] of writes) {
    it(`${name}: the statement`, async () => {
      const { pool, sent } = recordingPool();
      await run(manager(pool), ours);
      expect(sent).toMatchSnapshot();
    });
  }

  it('refuses an update with no filter — it used to rewrite every row', async () => {
    const { pool, sent } = recordingPool();
    await expect(manager(pool).update(ours, {}, { title: 'x' })).rejects.toThrow('Unsafe update blocked');
    expect(sent).toEqual([]);
  });

  it('refuses a write with nothing to set', async () => {
    const { pool } = recordingPool();
    await expect(manager(pool).update(ours, { id: 1 }, { title: undefined })).rejects.toThrow('No values to set');
  });
});

/**
 * Against a REAL Postgres: the writes answer and leave the rows the snapshots pin. SKIPS without `DB_READ_TEST_DATABASE_URL` — a THROWAWAY database.
 */
const url = process.env.DB_READ_TEST_DATABASE_URL;

describe.skipIf(!url)('our declared-table writes: the rows (real Postgres)', () => {
  const ours = SqlTable.define('write_equiv_own', ourColumns());
  let pool: Pool;
  const ddl = (name: string) => `CREATE TABLE ${name} (
    id serial PRIMARY KEY, slug text NOT NULL UNIQUE, title text, stock integer DEFAULT 0, price numeric,
    is_active boolean NOT NULL DEFAULT false, tags jsonb DEFAULT '[]', release_day date,
    ref uuid DEFAULT gen_random_uuid(), published_at timestamptz, created_at timestamptz DEFAULT now())`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 2 });
    await pool.query('DROP TABLE IF EXISTS write_equiv_own');
    await pool.query(ddl('write_equiv_own'));
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS write_equiv_own');
    await pool.end();
  });

  /** Generated per row (random uuid, now()): present and well-typed, never reproducible. */
  const comparable = (value: any): any => {
    if (Array.isArray(value)) return value.map(comparable);
    if (!value || typeof value !== 'object') return value;
    expect(typeof value.ref).toBe('string');
    expect(value.createdAt).toBeInstanceOf(Date);
    const { ref: _ref, createdAt: _createdAt, ...rest } = value;
    return rest;
  };

  it('every write answers, and leaves the rows, the snapshot pins', async () => {
    const db = manager(pool);
    const answers: Record<string, unknown> = {};
    for (const [name, run] of writes) answers[name] = comparable(await run(db, ours));
    expect(answers).toMatchSnapshot();
    expect(comparable(await db.find(ours, { orderBy: [Sql.asc(ours.id)] }))).toMatchSnapshot();
  });

  it('wrote what was asked — the snapshots pin the rest', async () => {
    const lamp = await manager(pool).findOne(ours, { slug: 'lamp' });
    expect(lamp).toMatchObject({ title: 'Lamp v2', stock: 6, price: '19.90', isActive: true, tags: { nested: { x: [1, 2] } }, releaseDay: '2026-03-01' });
    expect(lamp.publishedAt.toISOString()).toBe('2026-03-01T10:15:30.123Z');
    expect(await manager(pool).findOne(ours, { slug: 'chair' })).toMatchObject({ price: '100000000000.000001', stock: 0, isActive: true });
    expect(await manager(pool).findOne(ours, { slug: 'table' })).toBeNull();
    expect(await manager(pool).count(ours)).toBe(5);
  });
});
