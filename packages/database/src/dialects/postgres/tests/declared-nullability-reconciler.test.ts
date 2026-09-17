import { describe, expect, it } from 'vitest';
import { PostgresDeclaredNullabilityReconciler } from '@database/dialects/postgres/declared-nullability-reconciler';
import { SchemaReconcileState } from '@database/enums/schema-reconcile-state.enum';

/**
 * Relaxing a NOT NULL the schema no longer declares.
 *
 * The two tests that matter most are the ones asserting it does NOTHING: a reconcile that can widen
 * a primary key or tighten a column is far more dangerous than the gap it was written to close.
 */
describe('PostgresDeclaredNullabilityReconciler', () => {
  const recorder = (rows: Array<Record<string, unknown>>) => {
    const issued: Array<{ text: string; values?: unknown[] }> = [];
    const run = async (text: string, values?: unknown[]) => {
      issued.push({ text, values });
      return text.startsWith('SELECT') ? rows : [];
    };
    return { issued, run };
  };

  it('drops the NOT NULL when the column is NOT NULL and the schema says optional', async () => {
    const { issued, run } = recorder([{ is_nullable: 'NO', is_primary_key: false }]);

    const outcome = await new PostgresDeclaredNullabilityReconciler(run).relax('fcp_finance_payment_methods', 'notes');

    expect(outcome.state).toBe(SchemaReconcileState.CHANGED);
    expect(issued[1].text).toBe('ALTER TABLE "fcp_finance_payment_methods" ALTER COLUMN "notes" DROP NOT NULL');
  });

  it('does nothing when the column is already nullable — the overwhelmingly common case', async () => {
    const { issued, run } = recorder([{ is_nullable: 'YES', is_primary_key: false }]);

    const outcome = await new PostgresDeclaredNullabilityReconciler(run).relax('pages', 'notes');

    expect(outcome.state).toBe(SchemaReconcileState.SATISFIED);
    expect(issued).toHaveLength(1);
  });

  it('NEVER touches a primary key — its NOT NULL is structural, not a declaration', async () => {
    const { issued, run } = recorder([{ is_nullable: 'NO', is_primary_key: true }]);

    const outcome = await new PostgresDeclaredNullabilityReconciler(run).relax('pages', 'id');

    expect(outcome.state).toBe(SchemaReconcileState.SATISFIED);
    expect(issued).toHaveLength(1);
    expect(issued.some((entry) => entry.text.includes('DROP NOT NULL'))).toBe(false);
  });

  it('does nothing for a column the table does not have', async () => {
    const { issued, run } = recorder([]);

    const outcome = await new PostgresDeclaredNullabilityReconciler(run).relax('pages', 'ghost');

    expect(outcome.state).toBe(SchemaReconcileState.SATISFIED);
    expect(issued).toHaveLength(1);
  });

  it('never emits a statement that ADDS a NOT NULL, whatever the catalog says', async () => {
    for (const row of [{ is_nullable: 'NO', is_primary_key: false }, { is_nullable: 'YES', is_primary_key: false }]) {
      const { issued, run } = recorder([row]);
      await new PostgresDeclaredNullabilityReconciler(run).relax('pages', 'notes');
      // Tightening needs a value for rows that are already NULL, and inventing one is forbidden.
      expect(issued.some((entry) => entry.text.includes('SET NOT NULL'))).toBe(false);
    }
  });

  it('reports a failure rather than throwing — one declaration must not refuse the boot', async () => {
    const run = async (text: string) => {
      if (text.startsWith('SELECT')) return [{ is_nullable: 'NO', is_primary_key: false }];
      throw new Error('permission denied for table pages');
    };

    const outcome = await new PostgresDeclaredNullabilityReconciler(run).relax('pages', 'notes');

    expect(outcome.state).toBe(SchemaReconcileState.FAILED);
    expect(outcome.reason).toContain('permission denied');
  });

  it('refuses a name that is not a plain identifier, and issues no DDL', async () => {
    const { issued, run } = recorder([{ is_nullable: 'NO', is_primary_key: false }]);

    // Reported rather than thrown, like every other failure here: these names come from our own
    // collection schemas, so a bad one is a developer error to surface in the log, not a reason to
    // refuse the whole boot. What matters is that the statement is never built, so nothing runs.
    const outcome = await new PostgresDeclaredNullabilityReconciler(run).relax('pages"; DROP TABLE users; --', 'notes');

    expect(outcome.state).toBe(SchemaReconcileState.FAILED);
    expect(outcome.reason).toContain('not a plain SQL identifier');
    expect(issued.some((entry) => entry.text.includes('ALTER TABLE'))).toBe(false);
  });
});
