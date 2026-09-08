import { describe, expect, it } from 'vitest';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';

/**
 * Postgres stores timestamps with MICROSECOND precision, but the pg driver reads them back as JS
 * Dates, which carry only MILLISECONDS (sub-millisecond digits are TRUNCATED — verified live).
 * Binding such a read-back Date into a plain `col = $n` equality can never match the row again,
 * which made the optimistic-lock pattern `update(table, { id, updatedAt }, …)` report a concurrent
 * modification on EVERY write (the zeta visual editor 409'd on every block edit in production).
 * Equality against a Date operand must therefore compare the column truncated to milliseconds.
 */
describe('Postgres Date equality round-trip', () => {
  function managerWithCapturedQueries(): { db: PostgresDatabaseManager; calls: Array<{ text: string; values?: any[] }> } {
    const db = new PostgresDatabaseManager('postgresql://unused:unused@localhost:1/unused');
    const calls: Array<{ text: string; values?: any[] }> = [];
    // The normalizer holds the SAME pool object, so patching the method in place covers both.
    (db as any).pool.query = async (text: string, values?: any[]) => {
      calls.push({ text, values });
      if (text.includes('information_schema.columns')) {
        return {
          rows: [
            { column_name: 'id', data_type: 'integer' },
            { column_name: 'content', data_type: 'text' },
            { column_name: 'updated_at', data_type: 'timestamp with time zone' },
          ],
        };
      }
      return { rows: [{ id: 1 }], rowCount: 1 };
    };
    return { db, calls };
  }

  it('update() compares a Date where-operand with the column truncated to milliseconds', async () => {
    const { db, calls } = managerWithCapturedQueries();
    const readBack = new Date('2026-08-18T09:00:00.123Z');

    await db.update('fcp_zeta_pages', { id: 1, updatedAt: readBack }, { content: '[]' });

    const update = calls.find((call) => call.text.startsWith('UPDATE'));
    expect(update).toBeDefined();
    expect(update!.text).toContain(`date_trunc('milliseconds', "updated_at") = $3`);
    // Non-Date operands keep the plain column.
    expect(update!.text).toContain('"id" = $2');
    expect(update!.values).toEqual(['[]', 1, readBack]);
  });

  it('leaves non-Date equality untouched', async () => {
    const { db, calls } = managerWithCapturedQueries();

    await db.update('fcp_zeta_pages', { id: 7 }, { content: 'x' });

    const update = calls.find((call) => call.text.startsWith('UPDATE'));
    expect(update!.text).not.toContain('date_trunc');
  });

  it('raw filter builder truncates only eq/ne Date operands, never ranges', () => {
    const { db } = managerWithCapturedQueries();
    const reader = (db as any).reader;
    const when = new Date('2026-08-18T09:00:00.123Z');

    const { sql, values } = reader.buildRawFilterSQL({
      updatedAt: when,
      createdAt: { gte: when },
      slug: 'home',
    });

    expect(sql).toContain(`date_trunc('milliseconds', "updated_at") = $1`);
    expect(sql).toContain('"created_at" >= $2');
    expect(sql).toContain('"slug" = $3');
    expect(values).toEqual([when, when, 'home']);
  });
});
