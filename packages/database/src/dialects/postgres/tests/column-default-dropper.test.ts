import { describe, expect, it } from 'vitest';
import { PostgresColumnDefaultDropper } from '@database/dialects/postgres/column-default-dropper';
import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';

/** The DROP DEFAULT a plugin migration used raw SQL for, as a validated operation. */
describe('PostgresColumnDefaultDropper', () => {
  const recorder = (columnDefault: unknown) => {
    const issued: string[] = [];
    const run = async (text: string) => {
      issued.push(text);
      return text.startsWith('SELECT') ? (columnDefault === undefined ? [] : [{ column_default: columnDefault }]) : [];
    };
    return { issued, run };
  };

  it('drops a default that is there', async () => {
    const { issued, run } = recorder("'EUR'::text");
    const outcome = await new PostgresColumnDefaultDropper(run).drop('fcp_shop_products', 'currency');
    expect(outcome).toEqual(SchemaReconcileOutcome.changed());
    expect(issued[1]).toBe('ALTER TABLE "fcp_shop_products" ALTER COLUMN "currency" DROP DEFAULT');
  });

  it('does nothing when there is no default, or no such column', async () => {
    for (const value of [null, undefined]) {
      const { issued, run } = recorder(value);
      expect(await new PostgresColumnDefaultDropper(run).drop('fcp_shop_products', 'currency')).toEqual(SchemaReconcileOutcome.satisfied());
      expect(issued).toHaveLength(1);
    }
  });

  it('refuses an identifier that is not plain, rather than building the DDL', async () => {
    const { issued, run } = recorder("'x'");
    const outcome = await new PostgresColumnDefaultDropper(run).drop('fcp_shop_products', 'currency"; DROP TABLE users; --');
    expect(outcome.state).toBe(SchemaReconcileOutcome.failed('').state);
    expect(issued.some((text) => text.includes('DROP TABLE'))).toBe(false);
  });
});
