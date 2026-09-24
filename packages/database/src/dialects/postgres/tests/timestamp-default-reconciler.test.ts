import { describe, expect, it } from 'vitest';
import { PostgresTimestampDefaultReconciler } from '@database/dialects/postgres/timestamp-default-reconciler';
import { PostgresSchemaBuilder } from '@database/dialects/postgres/schema-builder';
import { SchemaReconcileState } from '@database/enums/schema-reconcile-state.enum';
import { PgDialect } from 'drizzle-orm/pg-core';

describe('PostgresTimestampDefaultReconciler', () => {
  const recorder = (rows: Array<Record<string, unknown>>) => {
    const issued: Array<{ text: string; values?: unknown[] }> = [];
    const run = async (text: string, values?: unknown[]) => {
      issued.push({ text, values });
      return text.startsWith('SELECT') ? rows : [];
    };
    return { issued, run };
  };

  it('gives a created_at column with no default its CURRENT_TIMESTAMP default', async () => {
    const { issued, run } = recorder([{ column_default: null }]);

    const outcome = await new PostgresTimestampDefaultReconciler(run).ensure('fcp_alpha_orders', 'created_at');

    expect(outcome.state).toBe(SchemaReconcileState.CHANGED);
    expect(issued[1].text).toBe('ALTER TABLE "fcp_alpha_orders" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP');
  });

  it('never replaces a default that is already there', async () => {
    const { issued, run } = recorder([{ column_default: 'CURRENT_TIMESTAMP' }]);

    const outcome = await new PostgresTimestampDefaultReconciler(run).ensure('fcp_alpha_orders', 'created_at');

    expect(outcome.state).toBe(SchemaReconcileState.SATISFIED);
    expect(issued).toHaveLength(1);
  });

  it('leaves a table without the column alone', async () => {
    const { issued, run } = recorder([]);

    const outcome = await new PostgresTimestampDefaultReconciler(run).ensure('fcp_alpha_orders', 'created_at');

    expect(outcome.state).toBe(SchemaReconcileState.SATISFIED);
    expect(issued).toHaveLength(1);
  });
});

describe('PostgresSchemaBuilder — a collection that claims createdAt', () => {
  const created = async (fields: Array<Record<string, unknown>>) => {
    const statements: string[] = [];
    const host = {
      execute: async (query: any) => { statements.push(new PgDialect().sqlToQuery(query).sql); },
      invalidateTableCache: () => undefined,
    } as any;
    await new PostgresSchemaBuilder(host).createTable({ slug: 'fcp_alpha_orders', fields } as any);
    return statements[0];
  };

  it('keeps the CURRENT_TIMESTAMP default on the column the field claims', async () => {
    const statement = await created([{ name: 'createdAt', type: 'date' }, { name: 'status', type: 'text' }]);
    expect(statement).toMatch(/"created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP/);
    expect(statement).toMatch(/updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP/);
  });

  it('stores a datetime field as a point in time, not TEXT', async () => {
    const statement = await created([{ name: 'validFrom', type: 'datetime' }]);
    expect(statement).toMatch(/"valid_from" TIMESTAMP WITH TIME ZONE\s*(,|\))/);
  });

  it('keeps the default when the claiming field is a date-and-time field', async () => {
    const statement = await created([{ name: 'createdAt', type: 'datetime' }]);
    expect(statement).toMatch(/"created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP/);
  });

  it('gives no other date field an invented default', async () => {
    const statement = await created([{ name: 'shippedAt', type: 'date' }]);
    expect(statement).toMatch(/"shipped_at" TIMESTAMP WITH TIME ZONE\s*(,|\))/);
  });
});
