import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { Sql } from '@database/sql/sql';
import { SqlColumns as c } from '@database/sql/sql-columns';
import { SqlTable } from '@database/sql/sql-table';

/**
 * Reads on a declared table are ours. Each case sends one statement, pinned in the snapshot beside this
 * file (text and bound values), and, against a real Postgres, answers the rows pinned there too: every
 * column type the schemas declare, nulls included. The snapshots were written when the same cases still
 * matched the query library this layer replaced, statement for statement and row for row.
 */

const ours = SqlTable.define('read_equiv_items', {
  id: c.serial('id').primaryKey(), title: c.text('title'), note: c.text('note'), stock: c.integer('stock'), price: c.numeric('price'), weight: c.real('weight'),
  isActive: c.boolean('is_active'), publishedAt: c.timestamp('published_at', { withTimezone: true }), localAt: c.timestamp('local_at'),
  localText: c.timestamp('local_text', { mode: 'string' }), releaseDay: c.date('release_day'), releaseDate: c.date('release_date', { mode: 'date' }),
  meta: c.json('meta'), tags: c.jsonb('tags'), ref: c.uuid('ref'), createdAt: c.timestamp('created_at', { withTimezone: true }).defaultNow(),
});
const ourTags = SqlTable.define('read_equiv_tags', { itemId: c.integer('item_id'), label: c.text('label') });

const april = new Date('2026-04-01T00:00:00.000Z');

/** [name, the framework's find() options]. */
const reads: Array<[string, any]> = [
  ['everything', {}],
  ['empty where', { where: {} }],
  ['equality', { where: { title: 'Lamp' } }],
  ['a JSON literal', { where: { tags: ['a', 'b'] } }],
  ['a range', { where: { stock: { gte: 1, lte: 10 } } }],
  ['a set', { where: { id: { in: [1, 3] } } }],
  ['an empty set', { where: { id: { in: [] } } }],
  ['null', { where: { title: null } }],
  ['a timestamp', { where: { publishedAt: { lt: april } } }],
  ['order, limit, offset', { orderBy: { createdAt: 'desc' }, limit: 2, offset: 1 }],
  ['order string', { orderBy: 'stock desc, title' }],
  ['an order expression', { orderBy: [Sql.desc(ours.id)] }],
  ['several conditions', { where: { isActive: true, stock: { gt: 0 } }, orderBy: { id: 'asc' }, limit: 50 }],
  ['a SQL-fragment filter', { where: Sql.eq(ours.stock, 4) }],
  ['picked columns', { columns: { id: true, title: true, tags: true, stock: false } }],
  ['a search', { where: { isActive: true }, search: { columns: ['title'], value: 'am' } }],
  ['a search over two columns', { search: { columns: ['title', 'note'], value: 'a' } }],
  ['picked columns over a join', {
    columns: { id: true, title: true },
    joins: [{ table: ourTags, on: Sql.eq(ours.id, ourTags.itemId), type: 'left' }],
    where: Sql.eq(ourTags.label, 'sale'), orderBy: [Sql.desc(ours.id)],
  }],
  ['a join with every column', { joins: [{ table: ourTags, on: Sql.eq(ours.id, ourTags.itemId), type: 'left' }], orderBy: [Sql.asc(ours.id)] }],
  ['an inner join', { joins: [{ table: ourTags, on: Sql.eq(ours.id, ourTags.itemId), type: 'inner' }] }],
];

/** [name, the framework's count() options]. */
const counts: Array<[string, any]> = [
  ['everything', {}],
  ['filtered', { where: { isActive: true } }],
  ['a range', { where: { stock: { gte: 1 } } }],
  ['over a join', { joins: [{ table: ourTags, on: Sql.eq(ours.id, ourTags.itemId), type: 'left' }], where: Sql.eq(ourTags.label, 'sale') }],
  ['with the search a list applies', { where: { isActive: true }, search: { columns: ['title'], value: 'am' } }],
];

function reader(pool: any) {
  const normalizer = { normalizeWhereForTable: async (_table: string, where: unknown) => where } as any;
  return new PostgresReadOperations(pool, normalizer, Sql.ilike);
}

describe('our declared-table reads: the statement', () => {
  const recordingPool = () => {
    const sent: Array<{ text: string; params: unknown[] }> = [];
    const query = vi.fn(async (config: any, values?: unknown[]) => {
      sent.push({ text: typeof config === 'string' ? config : config.text, params: values ?? [] });
      return { rows: [], fields: [] };
    });
    return { pool: { query }, sent };
  };
  for (const [name, options] of reads) {
    it(`find — ${name}: the statement`, async () => {
      const { pool, sent } = recordingPool();
      await reader(pool).find(ours, options);
      expect(sent).toMatchSnapshot();
    });
  }

  for (const [name, options] of counts) {
    it(`count — ${name}: the statement`, async () => {
      const { pool, sent } = recordingPool();
      await reader(pool).count(ours, options);
      expect(sent).toMatchSnapshot();
    });
  }
});

/**
 * Against a REAL Postgres. SKIPS without `DB_READ_TEST_DATABASE_URL` — point it at a THROWAWAY
 * database; the suite creates and drops its own tables.
 */
const url = process.env.DB_READ_TEST_DATABASE_URL;

describe.skipIf(!url)('our declared-table reads: the rows (real Postgres)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 2 });
    await pool.query('DROP TABLE IF EXISTS read_equiv_items, read_equiv_tags');
    await pool.query(`CREATE TABLE read_equiv_items (
      id serial PRIMARY KEY, title text, note text, stock integer, price numeric, weight real, is_active boolean,
      published_at timestamptz, local_at timestamp, local_text timestamp, release_day date, release_date date,
      meta json, tags jsonb, ref uuid, created_at timestamptz DEFAULT now())`);
    await pool.query('CREATE TABLE read_equiv_tags (item_id integer, label text)');
    await pool.query(`INSERT INTO read_equiv_items
      (title, note, stock, price, weight, is_active, published_at, local_at, local_text, release_day, release_date, meta, tags, ref, created_at) VALUES
      ('Lamp', 'by the bed', 4, 19.90, 1.25, true, '2026-03-01 10:15:30.123456+02', '2026-03-01 10:15:30.5', '2026-03-01 10:15:30', '2026-03-01', '2026-03-01',
       '{"a":1}', '["a","b"]', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-01-01T00:00:00Z'),
      ('Желязо', 'чугун', 0, 0, 0, false, '1999-12-31 23:59:59+00', '1999-12-31 23:59:59', '1999-12-31 23:59:59', '1999-12-31', '1999-12-31',
       'null', '{"nested":{"x":[1,2]}}', null, '2026-01-02T00:00:00Z'),
      (null, null, null, null, null, null, null, null, null, null, null, null, null, null, '2026-01-03T00:00:00Z'),
      ('Chair', null, 12, 100000000000.000001, 3.5, true, '2026-06-30 23:00:00+00', '2026-06-30 23:00:00', '2026-06-30 23:00:00', '2026-06-30', '2026-06-30',
       '[1,"x"]', '[]', '00000000-0000-0000-0000-000000000000', '2026-01-04T00:00:00Z')`);
    await pool.query(`INSERT INTO read_equiv_tags (item_id, label) VALUES (1, 'sale'), (1, 'new'), (4, 'sale')`);
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS read_equiv_items, read_equiv_tags');
    await pool.end();
  });

  for (const [name, options] of reads) {
    it(`find — ${name}: the rows`, async () => {
      expect(await reader(pool).find(ours, options)).toMatchSnapshot();
    });
  }

  for (const [name, options] of counts) {
    it(`count — ${name}: the total`, async () => {
      expect(await reader(pool).count(ours, options)).toMatchSnapshot();
    });
  }

  it('reads what it should — the snapshots pin the rest', async () => {
    const rows: any[] = await reader(pool).find(ours, { where: { isActive: true }, orderBy: { id: 'asc' } });
    expect(rows.map((row) => row.title)).toEqual(['Lamp', 'Chair']);
    expect(rows[0].publishedAt).toBeInstanceOf(Date);
    expect(rows[0].localText).toBe('2026-03-01 10:15:30');
    expect(rows[0].tags).toEqual(['a', 'b']);
    expect(rows[1].price).toBe('100000000000.000001');
    const joined: any[] = await reader(pool).find(ours, { joins: [{ table: ourTags, on: Sql.eq(ours.id, ourTags.itemId), type: 'left' }], orderBy: [Sql.asc(ours.id)] });
    expect(joined.find((row) => row.read_equiv_items.title === null).read_equiv_tags).toBeNull();
    expect(await reader(pool).count(ours, { where: { isActive: true } })).toBe(2);
  });
});
