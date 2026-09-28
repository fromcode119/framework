import { describe, expect, it, vi } from 'vitest';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';
import { PostgresSchemaIntrospector } from '@database/dialects/postgres/schema-introspector';

/**
 * `_system_meta` has no serial `id` — a tenant's row is identified by its natural key, `key`, and
 * the platform's own unique constraint is `("key", "tenant_id")`. This is what tells the importer's
 * upsert which columns to target, so a re-import updates the tenant's own row instead of failing (or
 * silently landing on) an unrelated one.
 */
describe('PostgresSchemaIntrospector.naturalKeyColumns', () => {
  it('reports the natural key columns of a constraint that already includes the tenant column', async () => {
    const run = vi.fn(async () => [{ table_name: '_system_meta', name: '_system_meta_pkey', columns: ['key'] }]) as unknown as ISqlRunner;
    const introspector = new PostgresSchemaIntrospector(run);
    const result = await introspector.naturalKeyColumns(['_system_meta'], 'tenant_id');
    expect(result.get('_system_meta')).toEqual(['key']);
    expect(run).toHaveBeenCalledWith(expect.stringContaining('pg_constraint'), [['_system_meta'], 'tenant_id']);
  });

  it('answers an empty map for tables with no such constraint', async () => {
    const run = vi.fn(async () => []) as unknown as ISqlRunner;
    const introspector = new PostgresSchemaIntrospector(run);
    const result = await introspector.naturalKeyColumns(['fcp_widgets_items'], 'tenant_id');
    expect(result.size).toBe(0);
  });

  it('short-circuits with no query for an empty table list', async () => {
    const run = vi.fn(async () => []) as unknown as ISqlRunner;
    const introspector = new PostgresSchemaIntrospector(run);
    const result = await introspector.naturalKeyColumns([], 'tenant_id');
    expect(result.size).toBe(0);
    expect(run).not.toHaveBeenCalled();
  });

  it('keeps the SMALLEST natural key when a table qualifies under more than one constraint', async () => {
    const run = vi.fn(async () => [
      { table_name: '_system_meta', name: 'wide_constraint', columns: ['key', 'group'] },
      { table_name: '_system_meta', name: '_system_meta_pkey', columns: ['key'] },
    ]) as unknown as ISqlRunner;
    const introspector = new PostgresSchemaIntrospector(run);
    const result = await introspector.naturalKeyColumns(['_system_meta'], 'tenant_id');
    expect(result.get('_system_meta')).toEqual(['key']);
  });
});
