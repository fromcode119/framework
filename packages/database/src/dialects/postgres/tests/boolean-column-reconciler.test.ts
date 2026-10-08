import { describe, expect, it } from 'vitest';
import { PostgresBooleanColumnReconciler } from '@database/dialects/postgres/boolean-column-reconciler';
import { SchemaReconcileState } from '@database/enums/schema-reconcile-state.enum';

describe('PostgresBooleanColumnReconciler', () => {
  const runner = (type: string, invalid: number, columnDefault: string | null) => {
    const statements: string[] = [];
    const run = async (sql: string) => {
      statements.push(sql);
      if (sql.includes('data_type')) return [{ data_type: type }];
      if (sql.includes('column_default')) return [{ column_default: columnDefault }];
      if (sql.includes('count(*)')) return [{ n: invalid }];
      return [];
    };
    return { run, statements };
  };

  it('converts a text column of true/false values, keeping its default as a boolean', async () => {
    const { run, statements } = runner('text', 0, "'true'::text");
    const outcome = await new PostgresBooleanColumnReconciler(run).ensure('fcp_tagiqx_registry', 'find_network');
    expect(outcome.state).toBe(SchemaReconcileState.CHANGED);
    expect(statements).toContain('ALTER TABLE "fcp_tagiqx_registry" ALTER COLUMN "find_network" DROP DEFAULT');
    expect(statements).toContain(`ALTER TABLE "fcp_tagiqx_registry" ALTER COLUMN "find_network" TYPE BOOLEAN USING NULLIF(btrim("find_network"), '')::boolean`);
    expect(statements).toContain('ALTER TABLE "fcp_tagiqx_registry" ALTER COLUMN "find_network" SET DEFAULT true');
  });

  it('leaves a boolean column alone, and a text column with other values as it is', async () => {
    expect((await new PostgresBooleanColumnReconciler(runner('boolean', 0, null).run).ensure('t', 'c')).state).toBe(SchemaReconcileState.SATISFIED);
    const { run, statements } = runner('text', 2, null);
    const outcome = await new PostgresBooleanColumnReconciler(run).ensure('t', 'c');
    expect(outcome.state).toBe(SchemaReconcileState.FAILED);
    expect(outcome.reason).toContain('2 value(s)');
    expect(statements.some((sql) => sql.startsWith('ALTER'))).toBe(false);
  });

  it('reads a text default as a boolean one, and nothing else', () => {
    expect(PostgresBooleanColumnReconciler.booleanDefault("'false'::text")).toBe('false');
    expect(PostgresBooleanColumnReconciler.booleanDefault('true')).toBe('true');
    expect(PostgresBooleanColumnReconciler.booleanDefault("'maybe'::text")).toBe('');
    expect(PostgresBooleanColumnReconciler.booleanDefault('')).toBe('');
  });
});
