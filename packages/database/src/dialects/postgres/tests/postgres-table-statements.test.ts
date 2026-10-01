import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, serial, text, integer, numeric, real, boolean, timestamp, date, json, jsonb, uuid } from 'drizzle-orm/pg-core';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { PostgresTableStatements } from '@database/dialects/postgres/postgres-table-statements';

/**
 * Whole-table reads are assembled by our own query layer, not Drizzle's builder. Nothing a caller
 * sees may change: the same statement (text and parameters) reaches Postgres, and the same rows come
 * back — every column type the schemas declare, nulls included.
 */

const items = pgTable('read_equiv_items', {
  id: serial('id').primaryKey(),
  title: text('title'),
  stock: integer('stock'),
  price: numeric('price'),
  weight: real('weight'),
  isActive: boolean('is_active'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  localAt: timestamp('local_at'),
  localText: timestamp('local_text', { mode: 'string' }),
  releaseDay: date('release_day'),
  releaseDate: date('release_date', { mode: 'date' }),
  meta: json('meta'),
  tags: jsonb('tags'),
  ref: uuid('ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/** Every shape of read the collection API and the framework's services issue against a typed table. */
const reads: Array<[string, any]> = [
  ['everything', {}],
  ['empty where', { where: {} }],
  ['equality', { where: { title: 'Lamp' } }],
  ['a JSON literal', { where: { tags: ['a', 'b'] } }],
  ['a range', { where: { stock: { gte: 1, lte: 10 } } }],
  ['a set', { where: { id: { in: [1, 3] } } }],
  ['an empty set', { where: { id: { in: [] } } }],
  ['null', { where: { title: null } }],
  ['a timestamp', { where: { publishedAt: { lt: new Date('2026-04-01T00:00:00.000Z') } } }],
  ['order, limit, offset', { orderBy: { createdAt: 'desc' }, limit: 2, offset: 1 }],
  ['order string', { orderBy: 'stock desc, title' }],
  ['a Drizzle order', { orderBy: [desc(items.id)] }],
  ['several conditions', { where: { isActive: true, stock: { gt: 0 } }, orderBy: { id: 'asc' }, limit: 50 }],
];

const counts: Array<[string, any]> = [
  ['everything', {}],
  ['filtered', { where: { isActive: true } }],
  ['a range', { where: { stock: { gte: 1 } } }],
];

function reader(pool: any) {
  const normalizer = { normalizeWhereForTable: async (_table: string, where: unknown) => where } as any;
  return new PostgresReadOperations(pool, drizzle(pool), normalizer, (() => undefined) as any);
}

const env = process.env.DB_READ_PATH;
afterEach(() => {
  if (env === undefined) delete process.env.DB_READ_PATH; else process.env.DB_READ_PATH = env;
  vi.restoreAllMocks();
});

describe('own whole-table reads: the statement', () => {
  /** Records what reaches the driver; answers no rows. */
  const recordingPool = () => {
    const sent: Array<{ text: string; params: unknown[] }> = [];
    const query = vi.fn(async (config: any, values?: unknown[]) => {
      sent.push({ text: typeof config === 'string' ? config : config.text, params: values ?? config.values ?? [] });
      return { rows: [], fields: [] };
    });
    return { pool: { query, connect: async () => ({ query, release() {} }) }, sent };
  };

  const sentBy = async (mode: string, run: (ops: PostgresReadOperations) => Promise<unknown>) => {
    process.env.DB_READ_PATH = mode;
    const { pool, sent } = recordingPool();
    await run(reader(pool));
    return sent;
  };

  for (const [name, options] of reads) {
    it(`find — ${name}: the same text and parameters as Drizzle's builder`, async () => {
      const own = await sentBy('own', (ops) => ops.find(items, options));
      const builder = await sentBy('drizzle', (ops) => ops.find(items, options));
      expect(own).toHaveLength(1);
      expect(own).toEqual(builder);
    });
  }

  for (const [name, options] of counts) {
    it(`count — ${name}: the same text and parameters as Drizzle's builder`, async () => {
      const own = await sentBy('own', (ops) => ops.count(items, options));
      const builder = await sentBy('drizzle', (ops) => ops.count(items, options));
      expect(own).toHaveLength(1);
      expect(own).toEqual(builder);
    });
  }

  it('a search on a typed table keeps the filter (a second Drizzle .where() used to replace it)', async () => {
    process.env.DB_READ_PATH = 'own';
    const { pool, sent } = recordingPool();
    const like = vi.fn((column: any, pattern: string) => ({ column, pattern }));
    const ops = new PostgresReadOperations(pool as any, drizzle(pool as any), { normalizeWhereForTable: async (_t: string, w: unknown) => w } as any, like as any);
    (ops as any).like = (await import('drizzle-orm')).ilike;
    await ops.find(items, { where: { isActive: true }, search: { columns: ['title'], value: 'lam' } });
    expect(sent[0].text).toMatch(/where \("read_equiv_items"\."is_active" = \$1 and "read_equiv_items"\."title" ilike \$2\)/);
    expect(sent[0].params).toEqual([true, '%lam%']);
  });

  it('logs a difference under shadow and answers with Drizzle\'s rows', () => {
    const lines: string[] = [];
    PostgresTableStatements.compare('find x', [{ a: 1, b: new Date(0) }], [{ a: 1, b: '1970-01-01' }], (line) => lines.push(line));
    PostgresTableStatements.compare('find y', [{ a: 1 }], [{ a: 1 }], (line) => lines.push(line));
    expect(lines).toEqual([expect.stringContaining('row 0 "b": own=Date')]);
  });
});

/**
 * Against a REAL Postgres: the rows themselves. SKIPS without `DB_READ_TEST_DATABASE_URL` — point it
 * at a THROWAWAY database; the suite creates and drops its own table.
 */
const url = process.env.DB_READ_TEST_DATABASE_URL;

describe.skipIf(!url)('own whole-table reads: the rows (real Postgres)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 2 });
    await pool.query('DROP TABLE IF EXISTS read_equiv_items');
    await pool.query(`CREATE TABLE read_equiv_items (
      id serial PRIMARY KEY, title text, stock integer, price numeric, weight real, is_active boolean,
      published_at timestamptz, local_at timestamp, local_text timestamp, release_day date, release_date date,
      meta json, tags jsonb, ref uuid, created_at timestamptz DEFAULT now())`);
    await pool.query(`INSERT INTO read_equiv_items
      (title, stock, price, weight, is_active, published_at, local_at, local_text, release_day, release_date, meta, tags, ref, created_at) VALUES
      ('Lamp', 4, 19.90, 1.25, true, '2026-03-01 10:15:30.123456+02', '2026-03-01 10:15:30.5', '2026-03-01 10:15:30', '2026-03-01', '2026-03-01',
       '{"a":1}', '["a","b"]', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-01-01T00:00:00Z'),
      ('Желязо', 0, 0, 0, false, '1999-12-31 23:59:59+00', '1999-12-31 23:59:59', '1999-12-31 23:59:59', '1999-12-31', '1999-12-31',
       'null', '{"nested":{"x":[1,2]}}', null, '2026-01-02T00:00:00Z'),
      (null, null, null, null, null, null, null, null, null, null, null, null, null, '2026-01-03T00:00:00Z'),
      ('Chair', 12, 100000000000.000001, 3.5, true, '2026-06-30 23:00:00+00', '2026-06-30 23:00:00', '2026-06-30 23:00:00', '2026-06-30', '2026-06-30',
       '[1,"x"]', '[]', '00000000-0000-0000-0000-000000000000', '2026-01-04T00:00:00Z')`);
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS read_equiv_items');
    await pool.end();
  });

  const answerOf = async (mode: string, run: (ops: PostgresReadOperations) => Promise<unknown>) => {
    process.env.DB_READ_PATH = mode;
    return run(reader(pool));
  };

  for (const [name, options] of reads) {
    it(`find — ${name}: the same rows as Drizzle`, async () => {
      const own = await answerOf('own', (ops) => ops.find(items, options));
      const builder = await answerOf('drizzle', (ops) => ops.find(items, options));
      expect(own).toStrictEqual(builder);
    });
  }

  for (const [name, options] of counts) {
    it(`count — ${name}: the same total as Drizzle`, async () => {
      const own = await answerOf('own', (ops) => ops.count(items, options));
      expect(own).toBe(await answerOf('drizzle', (ops) => ops.count(items, options)));
    });
  }

  it('finds the rows it should — not merely the same wrong answer twice', async () => {
    const rows = (await answerOf('own', (ops) => ops.find(items, { where: { isActive: true }, orderBy: { id: 'asc' } }))) as any[];
    expect(rows.map((row) => row.title)).toEqual(['Lamp', 'Chair']);
    expect(rows[0].publishedAt).toBeInstanceOf(Date);
    expect(rows[0].localText).toBe('2026-03-01 10:15:30');
    expect(rows[0].tags).toEqual(['a', 'b']);
    expect(await answerOf('own', (ops) => ops.count(items, { where: { isActive: true } }))).toBe(2);
  });

  it('shadow mode reports no difference on any of these reads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [, options] of reads) await answerOf('shadow', (ops) => ops.find(items, options));
    for (const [, options] of counts) await answerOf('shadow', (ops) => ops.count(items, options));
    expect(warn.mock.calls.filter((call) => String(call[0]).includes('[db-read-shadow]'))).toEqual([]);
  });
});
