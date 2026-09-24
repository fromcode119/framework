import { describe, expect, it } from 'vitest';
import { PostgresPointInTimeColumnReconciler } from '@database/dialects/postgres/point-in-time-column-reconciler';
import { SchemaReconcileState } from '@database/enums/schema-reconcile-state.enum';

describe('PostgresPointInTimeColumnReconciler', () => {
  const recorder = (dataType: string | null, invalid: number) => {
    const issued: string[] = [];
    const run = async (text: string) => {
      issued.push(text);
      if (text.includes('information_schema')) return dataType === null ? [] : [{ data_type: dataType }];
      if (text.startsWith('SELECT count')) return [{ n: invalid }];
      return [];
    };
    return { issued, run };
  };

  it('converts a text date column whose every value is ISO-8601, reading blanks as NULL', async () => {
    const { issued, run } = recorder('text', 0);

    const outcome = await new PostgresPointInTimeColumnReconciler(run).ensure('fcp_alpha_posts', 'published_at');

    expect(outcome.state).toBe(SchemaReconcileState.CHANGED);
    expect(issued[2]).toBe(
      'ALTER TABLE "fcp_alpha_posts" ALTER COLUMN "published_at" TYPE TIMESTAMP WITH TIME ZONE '
      + 'USING NULLIF(btrim("published_at"), \'\')::timestamptz',
    );
  });

  it('leaves the column text, and says why, when a value is not a date', async () => {
    const { issued, run } = recorder('text', 2);

    const outcome = await new PostgresPointInTimeColumnReconciler(run).ensure('fcp_alpha_posts', 'published_at');

    expect(outcome.state).toBe(SchemaReconcileState.FAILED);
    expect(outcome.reason).toMatch(/2 value\(s\) are not ISO-8601/);
    expect(issued.some((text) => text.startsWith('ALTER'))).toBe(false);
  });

  it('does nothing to a column that is already a timestamp, or absent', async () => {
    for (const type of ['timestamp with time zone', null]) {
      const { issued, run } = recorder(type, 0);
      const outcome = await new PostgresPointInTimeColumnReconciler(run).ensure('fcp_alpha_posts', 'published_at');
      expect(outcome.state).toBe(SchemaReconcileState.SATISFIED);
      expect(issued).toHaveLength(1);
    }
  });

  it('accepts exactly the ISO-8601 shapes the platform writes', () => {
    const iso = new RegExp(PostgresPointInTimeColumnReconciler.ISO_8601.replace(/\\\\d/g, '\\d'));
    for (const good of ['2026-03-22', '2026-03-22T00:00:00.000Z', '2026-09-09T09:00', '2026-09-09 09:00:00+03:00']) {
      expect(iso.test(good)).toBe(true);
    }
    for (const bad of ['yesterday', '22.03.2026', '2026-3-22', '1790175091000']) {
      expect(iso.test(bad)).toBe(false);
    }
  });
});
