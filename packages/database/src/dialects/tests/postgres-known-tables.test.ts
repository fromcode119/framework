import { describe, expect, it, vi } from 'vitest';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';

/**
 * The first-boot guard asked the catalog whether a table exists before EVERY read — half the statements
 * a request ran. A table seen to exist is remembered; a missing one is asked about again (it may be created
 * later), and a remembered table that has since been dropped answers what the guard would: nothing.
 */
function reader(existing: Set<string>) {
  const catalog = vi.fn(async ({ table }: { table: unknown }) => ({ rows: [{ total: existing.has(String(table)) ? 1 : 0 }] }));
  const rows = vi.fn(async (input: string | { text: string; values?: unknown[] }, given?: unknown[]) => {
    // A read is sent as a statement config (`PreparedStatements.mark`); the catalog question as text.
    const text = input === String(input) ? String(input) : (input as { text: string }).text;
    const values = given ?? (input === String(input) ? undefined : (input as { values?: unknown[] }).values);
    // The catalog question goes to the same connection as every other statement.
    if (text.includes('information_schema.tables')) return catalog({ table: values?.[0] });
    const table = /FROM "([^"]+)"/.exec(text)?.[1] ?? '';
    if (!existing.has(table)) throw Object.assign(new Error(`relation "${table}" does not exist`), { code: '42P01' });
    return { rows: [{ id: 1 }] };
  });
  const normalizer = { normalizeWhereForTable: async (_table: string, where: unknown) => where } as any;
  const ops = new PostgresReadOperations({ query: rows } as any, normalizer, (() => undefined) as any);
  return { ops, catalog, rows };
}

describe('Postgres reader: known tables', () => {
  it('asks the catalog once for a table it has seen, not before every read', async () => {
    const { ops, catalog } = reader(new Set(['fcp_shop_items']));
    for (let i = 0; i < 5; i += 1) expect(await ops.find('fcp_shop_items')).toEqual([{ id: 1 }]);
    expect(catalog).toHaveBeenCalledTimes(1);
  });

  it('keeps asking about a table that does not exist yet, so it is found once created', async () => {
    const existing = new Set<string>();
    const { ops, catalog } = reader(existing);
    expect(await ops.find('fcp_shop_later')).toEqual([]);
    existing.add('fcp_shop_later');
    expect(await ops.find('fcp_shop_later')).toEqual([{ id: 1 }]);
    expect(catalog).toHaveBeenCalledTimes(2);
  });

  it('answers nothing for a remembered table that has been dropped, and checks again next time', async () => {
    const existing = new Set(['fcp_shop_gone']);
    const { ops, catalog } = reader(existing);
    expect(await ops.find('fcp_shop_gone')).toEqual([{ id: 1 }]);
    existing.delete('fcp_shop_gone');
    expect(await ops.find('fcp_shop_gone')).toEqual([]);
    expect(await ops.find('fcp_shop_gone')).toEqual([]);
    expect(catalog).toHaveBeenCalledTimes(2);
  });
});
