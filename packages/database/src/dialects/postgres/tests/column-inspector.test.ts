import { describe, expect, it } from 'vitest';
import { PostgresColumnInspector } from '@database/dialects/postgres/column-inspector';

/**
 * The evidence an operator sees before approving an IRREVERSIBLE drop.
 *
 * Asserted on the STATEMENT, not on a stubbed result. Every test of the service above this stubs
 * `columnStats`, which is exactly why the first version shipped a statement that threw for `jsonb`
 * and `boolean` — the two commonest orphan types — with a green suite. A stub cannot fail the way
 * Postgres does, so the statement itself has to be the thing under test.
 */
describe('PostgresColumnInspector.stats — the statement', () => {
  const capture = () => {
    const issued: string[] = [];
    const run = async (text: string) => {
      issued.push(text);
      return [{ rows: 3, non_null: 2, non_empty: 1, sample: 'x' }];
    };
    return { issued, run };
  };

  it('NEVER uses max(), which does not exist for jsonb or boolean', async () => {
    const { issued, run } = capture();

    await new PostgresColumnInspector(run).stats('fcp_ecommerce_products', 'license_product');

    // `max(jsonb)` and `max(boolean)` are hard errors in Postgres, and the schema builder maps
    // json/relationship/upload/richText to JSONB and boolean/checkbox to BOOLEAN — so a sample
    // picked with max() fails for most of the columns that actually go orphaned.
    expect(issued[0]).not.toMatch(/\bmax\s*\(/i);
  });

  it('casts to text, so every column type can be sampled', async () => {
    const { issued, run } = capture();

    await new PostgresColumnInspector(run).stats('t', 'c');

    expect(issued[0]).toContain('"c"::text');
  });

  it('counts NON-EMPTY separately from non-null', async () => {
    const { issued, run } = capture();

    const stats = await new PostgresColumnInspector(run).stats('t', 'c');

    // `count(col)` counts an empty string as a value: a column that is '' on every row reported
    // "15 of 15 rows held a value" and sorted to the top as the most dangerous drop in the queue,
    // while being the safest one in it.
    expect(issued[0]).toContain("count(nullif(btrim(\"c\"::text), ''))");
    expect(stats.nonNull).toBe(2);
    expect(stats.nonEmpty).toBe(1);
  });

  it('takes the sample from a non-empty row, not the maximum', async () => {
    const { issued, run } = capture();

    await new PostgresColumnInspector(run).stats('t', 'c');

    // The maximum of a date column is always the newest value, which reads as "still in use"
    // whatever the distribution.
    expect(issued[0]).toContain('LIMIT 1');
    expect(issued[0]).toContain("btrim(t.\"c\"::text) <> ''");
  });

  it('refuses a name that is not a plain identifier, for stats and for drop alike', async () => {
    const { run } = capture();
    const inspector = new PostgresColumnInspector(run);

    await expect(inspector.stats('t"; DROP TABLE users; --', 'c')).rejects.toThrow(/not a plain SQL identifier/);
    await expect(inspector.drop('t', 'c"; DROP TABLE users; --')).rejects.toThrow(/not a plain SQL identifier/);
  });

  it('drop emits exactly one DROP COLUMN and nothing else', async () => {
    const { issued, run } = capture();

    await new PostgresColumnInspector(run).drop('fcp_hub_clients', 'custom_rates');

    expect(issued).toEqual(['ALTER TABLE "fcp_hub_clients" DROP COLUMN IF EXISTS "custom_rates"']);
  });
});
