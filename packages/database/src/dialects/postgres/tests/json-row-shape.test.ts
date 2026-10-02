import { describe, expect, it } from 'vitest';
import { JsonRowShape } from '@database/dialects/postgres/json-row-shape';

/**
 * A table's JSON row shape names each column by its camelCase field name, in table order, and casts
 * what JSON cannot carry exactly; any column type it cannot reproduce gives the table no shape.
 */
const column = (name: string, type: number, kind = 'b') => ({ name, type, kind, signature: 'sig' });

describe('JsonRowShape', () => {
  it('maps every supported type the way the row parser reads it', () => {
    const shape = JsonRowShape.of('fcp_alpha_items', [
      column('id', 23), column('custom_permalink', 25), column('price', 1700), column('stock_big', 20),
      column('ratio', 701), column('created_at', 1184), column('metadata', 3802), column('is_active', 16), column('state', 99999, 'e'),
    ]);
    expect(shape).not.toBeNull();
    expect(shape!.revive).toEqual({ ratio: 'float', createdAt: 'timestamp' });
    expect(shape!.signature).toBe('sig');
    const sql = shape!.statement('SELECT * FROM "fcp_alpha_items" LIMIT 5');
    expect(sql).toContain('r."custom_permalink" AS "customPermalink"');
    expect(sql).toContain('r."price"::text AS "price"');
    expect(sql).toContain('r."stock_big"::text AS "stockBig"');
    expect(sql).toContain('r."ratio"::text AS "ratio"');
    expect(sql).toContain('r."state" AS "state"');
    expect(sql).toContain('(SELECT * FROM "fcp_alpha_items" LIMIT 5) r');
    expect(sql).toContain(`'public."fcp_alpha_items"'::regclass`);
    expect(sql.indexOf('"id"')).toBeLessThan(sql.indexOf('"customPermalink"'));
  });

  it.each([
    ['a timestamp without a zone', 1114],
    ['a date', 1082],
    ['an array', 1009],
    ['bytea', 17],
    ['interval', 1186],
  ])('gives no shape to a table with %s', (_label, type) => {
    expect(JsonRowShape.of('fcp_alpha_items', [column('id', 23), column('x', type)])).toBeNull();
  });

  it('gives no shape to a name it would have to quote', () => {
    expect(JsonRowShape.of('fcp_alpha"items', [column('id', 23)])).toBeNull();
    expect(JsonRowShape.of('fcp_alpha_items', [column('Weird Name', 25)])).toBeNull();
    expect(JsonRowShape.of('fcp_alpha_items', [])).toBeNull();
  });
});
