import { describe, expect, it } from 'vitest';
import { Sql } from '@database/sql/sql';
import { SqlColumns as c } from '@database/sql/sql-columns';
import { SqlRenderer } from '@database/sql/sql-renderer';
import { SqlTable } from '@database/sql/sql-table';

/**
 * Every expression the framework builds must render to the same statement — text and bound values,
 * encoded the same way — in each dialect. The snapshot beside this file pins them; it was written when
 * each case still matched, byte for byte, the query library this layer replaced.
 */

const ours = SqlTable.define('items', {
  id: c.serial('id').primaryKey(), title: c.text('title'), stock: c.integer('stock'), price: c.numeric('price'), weight: c.real('weight'),
  isActive: c.boolean('is_active'), at: c.timestamp('at', { withTimezone: true }), local: c.timestamp('local'), atText: c.timestamp('at_text', { mode: 'string' }),
  day: c.date('day'), dayDate: c.date('day_date', { mode: 'date' }), meta: c.json('meta'), tags: c.jsonb('tags'), ref: c.uuid('ref'),
});
const oursInSchema = SqlTable.defineIn('tenant_a', 'docs', { id: c.serial('id') });

/** One case: an expression built from the framework's SQL helpers. */
type Build = (s: { sql: any; t: any; ops: any; schemaTable: any }) => unknown;
const at = new Date('2026-03-01T10:15:30.123Z');
const cases: Array<[string, Build]> = [
  ['plain text', ({ sql }) => sql`select 1`],
  ['values are bound, in order', ({ sql }) => sql`select ${1}, ${'two'}, ${null}, ${true}, ${at}`],
  ['an undefined value renders as nothing', ({ sql }) => sql`select 1${undefined}`],
  ['an empty template', ({ sql }) => sql``],
  ['raw text is never bound', ({ sql }) => sql.raw(`CREATE INDEX IF NOT EXISTS "x" ON "y" ("z")`)],
  ['identifiers are quoted, quotes doubled', ({ sql }) => sql`select ${sql.identifier('weird"name')} from ${sql.identifier('t')}`],
  ['join with a separator', ({ sql }) => sql.join([sql`a`, sql`b`, sql.identifier('c')], sql`, `)],
  ['join without a separator', ({ sql }) => sql.join([sql`a`, sql` b`])],
  ['a list is parenthesised', ({ sql }) => sql`in ${[1, 'x', sql`now()`]}`],
  ['nested fragments keep numbering', ({ sql }) => sql`${sql`a = ${1}`} and ${sql`b = ${2}`} or ${3}`],
  ['a table and a column', ({ sql, t }) => sql`select ${t.title} from ${t}`],
  ['a schema-qualified table', ({ sql, schemaTable }) => sql`select ${schemaTable.id} from ${schemaTable}`],
  ['eq binds through the column', ({ ops, t }) => ops.eq(t.tags, ['a', { b: 1 }])],
  ['eq on a timestamp encodes ISO', ({ ops, t }) => ops.eq(t.at, at)],
  ['eq on a date-mode date', ({ ops, t }) => ops.eq(t.dayDate, at)],
  ['eq on a string-mode timestamp passes text', ({ ops, t }) => ops.eq(t.atText, '2026-03-01 10:15:30')],
  ['eq with SQL on the right', ({ ops, t, sql }) => ops.eq(t.stock, sql`${t.stock} + 1`)],
  ['eq on an identifier binds raw', ({ ops, sql }) => ops.eq(sql.identifier('created_at'), at)],
  ['column compared with a column', ({ ops, t }) => ops.eq(t.stock, t.id)],
  ['ne / gt / gte / lt / lte', ({ ops, t }) => ops.and(ops.ne(t.title, 'x'), ops.gt(t.stock, 1), ops.gte(t.price, '1.5'), ops.lt(t.weight, 2.5), ops.lte(t.id, 9))],
  ['and of one is itself', ({ ops, t }) => ops.and(ops.eq(t.id, 1))],
  ['and drops undefined', ({ ops, t }) => ops.and(undefined, ops.eq(t.id, 1), undefined, ops.eq(t.title, 'a'))],
  ['or nested in and', ({ ops, t }) => ops.and(ops.or(ops.eq(t.id, 1), ops.eq(t.id, 2)), ops.not(ops.eq(t.isActive, false)))],
  ['null tests', ({ ops, t }) => ops.or(ops.isNull(t.title), ops.isNotNull(t.ref))],
  ['inArray / notInArray', ({ ops, t }) => ops.and(ops.inArray(t.id, [1, 2, 3]), ops.notInArray(t.tags, [['a'], ['b']]))],
  ['empty inArray / notInArray', ({ ops, t }) => ops.and(ops.inArray(t.id, []), ops.notInArray(t.id, []))],
  ['between / notBetween', ({ ops, t }) => ops.and(ops.between(t.at, at, at), ops.notBetween(t.stock, 1, 5))],
  ['like / ilike patterns are bound raw', ({ ops, t }) => ops.or(ops.like(t.title, '%a%'), ops.notLike(t.title, 'b%'), ops.ilike(t.title, '%C'), ops.notIlike(t.title, 'd'))],
  ['exists', ({ ops, sql }) => ops.and(ops.exists(sql`(select 1)`), ops.notExists(sql`(select 2)`))],
  ['order expressions', ({ ops, t, sql }) => sql.join([ops.asc(t.id), ops.desc(sql.identifier('created_at'))], sql`, `)],
  ['aggregates', ({ ops, t, sql }) => sql.join([ops.count(), ops.count(t.id), ops.avg(t.price), ops.sum(t.stock), ops.min(t.at), ops.max(t.weight)], sql`, `)],
  ['param with an encoder', ({ sql, t }) => sql`set ${sql.param({ x: 1 }, t.meta)}, ${sql.param(null, t.meta)}`],
  ['append', ({ sql }) => sql`a = ${1}`.append(sql` and b = ${2}`)],
];

const dialects: Array<[string, SqlRenderer]> = [
  ['postgres', SqlRenderer.POSTGRES],
  ['sqlite', SqlRenderer.SQLITE],
  ['mysql', SqlRenderer.MYSQL],
];

describe('our SQL renders the pinned statements', () => {
  for (const [dialectName, renderer] of dialects) {
    for (const [name, build] of cases) {
      it(`${dialectName}: ${name}`, () => {
        expect(renderer.render(build({ sql: Sql.tag(), t: ours, ops: Sql, schemaTable: oursInSchema }))).toMatchSnapshot();
      });
    }
  }
});

describe('our columns decode and encode the pinned values', () => {
  const samples: Record<string, unknown[]> = {
    id: [1, '7'], title: ['x', ''], stock: [3, '42'], price: ['19.90', 12.5, '100000000000.000001'], weight: [1.25, '2.5'],
    isActive: [true, false], at: ['2026-03-01 10:15:30.123+02', at], local: ['2026-03-01 10:15:30.5', at], atText: ['2026-03-01 10:15:30', at],
    day: ['2026-03-01', at], dayDate: ['2026-03-01'], meta: ['{"a":1}', { a: 1 }, 'not json', [1]], tags: ['["a"]', ['a'], 'null'], ref: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
  };
  for (const [key, values] of Object.entries(samples)) {
    it(`${key}: decodes and encodes`, () => {
      const column: any = (ours as any)[key];
      const encodes = (value: unknown) => !(typeof value === 'string' && ['at', 'local', 'day', 'dayDate'].includes(key));
      expect(values.map((value) => [column.mapFromDriverValue(value), encodes(value) ? column.mapToDriverValue(value) : undefined])).toMatchSnapshot();
    });
  }

  it('declares the pinned names, defaults and keys', () => {
    expect(Object.entries(SqlTable.columnsOf(ours)).map(([key, column]) => [key, column.name, column.notNull, column.primary])).toMatchSnapshot();
    expect(SqlTable.nameOf(ours)).toBe('items');
  });
});
