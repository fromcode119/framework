import { describe, expect, it } from 'vitest';
import * as d from 'drizzle-orm';
import { PgDialect, pgTable, pgSchema, serial, text, integer, numeric, real, boolean, timestamp, date, json, jsonb, uuid } from 'drizzle-orm/pg-core';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { Sql } from '@database/sql/sql';
import { SqlColumns as c } from '@database/sql/sql-columns';
import { SqlRenderer } from '@database/sql/sql-renderer';
import { SqlTable } from '@database/sql/sql-table';

/**
 * Our SQL layer replaced Drizzle's. Every expression the framework builds must render to the statement
 * Drizzle rendered — the same text and the same bound values, encoded the same way — in each dialect.
 * Drizzle is a dev dependency for exactly this comparison.
 */

const theirs = pgTable('items', {
  id: serial('id').primaryKey(), title: text('title'), stock: integer('stock'), price: numeric('price'), weight: real('weight'),
  isActive: boolean('is_active'), at: timestamp('at', { withTimezone: true }), local: timestamp('local'), atText: timestamp('at_text', { mode: 'string' }),
  day: date('day'), dayDate: date('day_date', { mode: 'date' }), meta: json('meta'), tags: jsonb('tags'), ref: uuid('ref'),
});
const ours = SqlTable.define('items', {
  id: c.serial('id').primaryKey(), title: c.text('title'), stock: c.integer('stock'), price: c.numeric('price'), weight: c.real('weight'),
  isActive: c.boolean('is_active'), at: c.timestamp('at', { withTimezone: true }), local: c.timestamp('local'), atText: c.timestamp('at_text', { mode: 'string' }),
  day: c.date('day'), dayDate: c.date('day_date', { mode: 'date' }), meta: c.json('meta'), tags: c.jsonb('tags'), ref: c.uuid('ref'),
});
const theirsInSchema = pgSchema('tenant_a').table('docs', { id: serial('id') });
const oursInSchema = SqlTable.defineIn('tenant_a', 'docs', { id: c.serial('id') });

/** One case: the same expression, written once against each library. */
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

const ourOps = Sql;
const dialects: Array<[string, { sqlToQuery(q: any): { sql: string; params: unknown[] } }, SqlRenderer]> = [
  ['postgres', new PgDialect(), SqlRenderer.POSTGRES],
  ['sqlite', new SQLiteSyncDialect(), SqlRenderer.SQLITE],
  ['mysql', new MySqlDialect(), SqlRenderer.MYSQL],
];

describe('our SQL renders exactly as Drizzle did', () => {
  for (const [dialectName, drizzleDialect, renderer] of dialects) {
    for (const [name, build] of cases) {
      it(`${dialectName}: ${name}`, () => {
        const expected = drizzleDialect.sqlToQuery(build({ sql: d.sql, t: theirs, ops: d, schemaTable: theirsInSchema }) as any);
        const actual = renderer.render(build({ sql: Sql.tag(), t: ours, ops: ourOps, schemaTable: oursInSchema }));
        expect(actual).toEqual({ text: expected.sql, params: expected.params });
      });
    }
  }
});

describe('our columns decode exactly as Drizzle\'s', () => {
  const samples: Record<string, unknown[]> = {
    id: [1, '7'], title: ['x', ''], stock: [3, '42'], price: ['19.90', 12.5, '100000000000.000001'], weight: [1.25, '2.5'],
    isActive: [true, false], at: ['2026-03-01 10:15:30.123+02', at], local: ['2026-03-01 10:15:30.5', at], atText: ['2026-03-01 10:15:30', at],
    day: ['2026-03-01', at], dayDate: ['2026-03-01'], meta: ['{"a":1}', { a: 1 }, 'not json', [1]], tags: ['["a"]', ['a'], 'null'], ref: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
  };
  for (const [key, values] of Object.entries(samples)) {
    it(`${key}: decodes and encodes the same`, () => {
      for (const value of values) {
        const theirColumn: any = (theirs as any)[key];
        const ourColumn: any = (ours as any)[key];
        expect(ourColumn.mapFromDriverValue(value)).toStrictEqual(theirColumn.mapFromDriverValue(value));
        if (!(typeof value === 'string' && ['at', 'local', 'day', 'dayDate'].includes(key))) {
          expect(ourColumn.mapToDriverValue(value)).toStrictEqual(theirColumn.mapToDriverValue(value));
        }
      }
    });
  }

  it('declares the same names, defaults and keys', () => {
    for (const [key, column] of Object.entries(d.getTableColumns(theirs))) {
      const ourColumn = SqlTable.columnsOf(ours)[key];
      expect([ourColumn.name, ourColumn.notNull, ourColumn.primary]).toEqual([column.name, column.notNull, column.primary]);
    }
    expect(Object.keys(SqlTable.columnsOf(ours))).toEqual(Object.keys(d.getTableColumns(theirs)));
    expect(SqlTable.nameOf(ours)).toBe(d.getTableName(theirs));
  });
});
