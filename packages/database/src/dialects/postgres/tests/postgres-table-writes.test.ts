import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import * as d from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, serial, text, integer, numeric, boolean, timestamp, date, jsonb, uuid } from 'drizzle-orm/pg-core';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { Sql } from '@database/sql/sql';
import { SqlColumns as c } from '@database/sql/sql-columns';
import { SqlTable } from '@database/sql/sql-table';

/**
 * Writes on a declared table are ours, not Drizzle's. Each write is written twice — the framework's
 * call on our table, and the Drizzle builder it replaces on an identical Drizzle table — and must send
 * the same statement (same columns, same order, `default` where absent, each value encoded by its own
 * column) and, against a real Postgres, write and answer the same rows.
 */

const ourColumns = () => ({
  id: c.serial('id').primaryKey(), slug: c.text('slug').notNull().unique(), title: c.text('title'), stock: c.integer('stock').default(0),
  price: c.numeric('price'), isActive: c.boolean('is_active').notNull().default(false), tags: c.jsonb('tags').default([]),
  releaseDay: c.date('release_day'), ref: c.uuid('ref').defaultRandom(), publishedAt: c.timestamp('published_at', { withTimezone: true }),
  createdAt: c.timestamp('created_at', { withTimezone: true }).defaultNow(),
});
const theirColumns = () => ({
  id: serial('id').primaryKey(), slug: text('slug').notNull().unique(), title: text('title'), stock: integer('stock').default(0),
  price: numeric('price'), isActive: boolean('is_active').notNull().default(false), tags: jsonb('tags').default([]),
  releaseDay: date('release_day'), ref: uuid('ref').defaultRandom(), publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
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

/** [name, the framework's call on our table, the Drizzle write it replaces on theirs]. */
const writes: Array<[string, (db: any, t: any) => Promise<unknown>, (orm: any, t: any) => any]> = [
  ['insert, every value',
    (db, t) => db.insert(t, { slug: 'lamp', title: 'Lamp', stock: 4, price: '19.90', isActive: true, tags: ['a', 'b'], releaseDay: '2026-03-01', publishedAt: at }),
    (orm, t) => orm.insert(t).values({ slug: 'lamp', title: 'Lamp', stock: 4, price: '19.90', isActive: true, tags: ['a', 'b'], releaseDay: '2026-03-01', publishedAt: at }).returning()],
  ['insert, defaults for the rest', (db, t) => db.insert(t, { slug: 'chair' }), (orm, t) => orm.insert(t).values({ slug: 'chair' }).returning()],
  ['insert, an explicit null and an unknown key',
    (db, t) => db.insert(t, { slug: 'желязо', title: null, notAColumn: 'ignored' }),
    (orm, t) => orm.insert(t).values({ slug: 'желязо', title: null, notAColumn: 'ignored' }).returning()],
  ['insert, several rows',
    (db, t) => db.insert(t, [{ slug: 'desk', stock: 2 }, { slug: 'shelf', title: 'Shelf' }]),
    (orm, t) => orm.insert(t).values([{ slug: 'desk', stock: 2 }, { slug: 'shelf', title: 'Shelf' }]).returning()],
  ['update by id',
    (db, t) => db.update(t, { id: 1 }, { title: 'Lamp (edited)', stock: 5, tags: { nested: { x: [1, 2] } } }),
    (orm, t) => orm.update(t).set({ title: 'Lamp (edited)', stock: 5, tags: { nested: { x: [1, 2] } } }).where(d.eq(t.id, 1)).returning()],
  ['update by a range, skipping an undefined value',
    (db, t) => db.update(t, { stock: { gte: 0, lte: 1 } }, { isActive: true, title: undefined }),
    (orm, t) => orm.update(t).set({ isActive: true, title: undefined }).where(d.and(d.gte(t.stock, 0), d.lte(t.stock, 1))).returning()],
  ['update by a SQL fragment',
    (db, t) => db.update(t, Sql.eq(t.slug, 'chair'), { price: '100000000000.000001' }),
    (orm, t) => orm.update(t).set({ price: '100000000000.000001' }).where(d.eq(t.slug, 'chair')).returning()],
  ['update with a SQL value',
    (db, t) => db.update(t, { slug: 'lamp' }, { stock: Sql.query`${t.stock} + 1` }),
    (orm, t) => orm.update(t).set({ stock: d.sql`${t.stock} + 1` }).where(d.eq(t.slug, 'lamp')).returning()],
  ['upsert, conflict',
    (db, t) => db.upsert(t, { slug: 'lamp', title: 'Lamp v2' }, { target: 'slug', set: { title: 'Lamp v2' } }),
    (orm, t) => orm.insert(t).values({ slug: 'lamp', title: 'Lamp v2' }).onConflictDoUpdate({ target: t.slug, set: { title: 'Lamp v2' } }).returning()],
  ['upsert, new row',
    (db, t) => db.upsert(t, { slug: 'table', stock: 7 }, { target: 'slug', set: { stock: 7 } }),
    (orm, t) => orm.insert(t).values({ slug: 'table', stock: 7 }).onConflictDoUpdate({ target: t.slug, set: { stock: 7 } }).returning()],
  ['delete by a set', (db, t) => db.delete(t, { slug: { in: ['table', 'nothing'] } }), (orm, t) => orm.delete(t).where(d.inArray(t.slug, ['table', 'nothing'])).returning()],
  ['delete nothing', (db, t) => db.delete(t, { id: 999 }), (orm, t) => orm.delete(t).where(d.eq(t.id, 999)).returning()],
];

describe('our declared-table writes: the statement', () => {
  const ours = SqlTable.define('write_equiv', ourColumns());
  const theirs = pgTable('write_equiv', theirColumns());
  const recordingPool = () => {
    const sent: Array<{ text: string; params: unknown[] }> = [];
    const query = vi.fn(async (config: any, values?: unknown[]) => {
      sent.push({ text: typeof config === 'string' ? config : config.text, params: values ?? [] });
      return { rows: [], rowCount: 0, fields: [] };
    });
    return { pool: { query }, sent };
  };

  for (const [name, run, build] of writes) {
    it(`${name}: the statement Drizzle sent`, async () => {
      const { pool, sent } = recordingPool();
      await run(manager(pool), ours);
      const built = build(drizzle({} as any), theirs).toSQL();
      expect(sent).toEqual([{ text: built.sql, params: built.params }]);
    });
  }

  it('refuses an update with no filter — it used to rewrite every row', async () => {
    const { pool, sent } = recordingPool();
    await expect(manager(pool).update(ours, {}, { title: 'x' })).rejects.toThrow('Unsafe update blocked');
    expect(sent).toEqual([]);
  });

  it('refuses a write with nothing to set, as Drizzle did', async () => {
    const { pool } = recordingPool();
    await expect(manager(pool).update(ours, { id: 1 }, { title: undefined })).rejects.toThrow('No values to set');
  });
});

/**
 * Against a REAL Postgres: the same writes through each, on twin tables, must answer the same and
 * leave the same rows. SKIPS without `DB_READ_TEST_DATABASE_URL` — a THROWAWAY database.
 */
const url = process.env.DB_READ_TEST_DATABASE_URL;

describe.skipIf(!url)('our declared-table writes: the rows (real Postgres)', () => {
  const ours = SqlTable.define('write_equiv_own', ourColumns());
  const theirs = pgTable('write_equiv_drizzle', theirColumns());
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
    const orm = drizzle(pool);
    for (const [name, run, build] of writes) {
      const answer = await run(db, ours);
      const drizzleRows = await build(orm, theirs);
      // The manager answers the first written row, or for a delete whether any row went.
      const expected = name.startsWith('delete') ? drizzleRows.length > 0 : drizzleRows[0];
      expect(comparable(answer), name).toStrictEqual(comparable(expected));
    }
    const ourRows = comparable(await db.find(ours, { orderBy: [Sql.asc(ours.id)] }));
    const theirRows = comparable(await orm.select().from(theirs).orderBy(d.asc(theirs.id)));
    expect(ourRows).toStrictEqual(theirRows);
  });

  it('wrote what was asked — not merely the same wrong thing twice', async () => {
    const lamp = await manager(pool).findOne(ours, { slug: 'lamp' });
    expect(lamp).toMatchObject({ title: 'Lamp v2', stock: 6, price: '19.90', isActive: true, tags: { nested: { x: [1, 2] } }, releaseDay: '2026-03-01' });
    expect(lamp.publishedAt.toISOString()).toBe('2026-03-01T10:15:30.123Z');
    expect(await manager(pool).findOne(ours, { slug: 'chair' })).toMatchObject({ price: '100000000000.000001', stock: 0, isActive: true });
    expect(await manager(pool).findOne(ours, { slug: 'table' })).toBeNull();
    expect(await manager(pool).count(ours)).toBe(5);
  });
});
