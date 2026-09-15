import { describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantRowInserter } from '@core/tenant/provisioning/tenant-row-inserter';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/** Captures every INSERT and decodes it back into a column → value record, by column NAME. */
function fakeDb(): { db: IDatabaseManager; inserted: () => Record<string, unknown> } {
  let last: Record<string, unknown> = {};
  const db = {
    queryRaw: vi.fn(async (sql: string, params: unknown[] = []) => {
      const match = /INSERT INTO "[^"]+" \(([^)]+)\)/.exec(sql);
      if (match) {
        const columns = match[1].split(',').map((c) => c.trim().replace(/"/g, ''));
        last = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
      }
      return [];
    }),
  } as unknown as IDatabaseManager;
  return { db, inserted: () => last };
}

const TABLE = 'fcp_widgets_items';

function descriptor(references: TenantColumnReference[], columns: Record<string, string> = {}): TenantTableDescriptor {
  return new TenantTableDescriptor(
    TABLE,
    { id: 'integer', tenant_id: 'text', siblings: 'jsonb', rules: 'jsonb', category_id: 'integer', ...columns },
    true,
    'fcp_widgets_items_id_seq',
    references,
  );
}

function inserter(table: TenantTableDescriptor, remap: TenantIdRemap, warnings: string[] = []): { inserter: TenantRowInserter; inserted: () => Record<string, unknown> } {
  const { db, inserted } = fakeDb();
  return { inserter: new TenantRowInserter(db, table, 't1', remap, new TenantImportFiles('/tmp/fc-test-uploads'), warnings), inserted };
}

describe('TenantRowInserter — declared-path re-pointing', () => {
  it('re-points a bare array of ids ([7])', async () => {
    const ref = new TenantColumnReference(TABLE, 'siblings', TABLE, 'schema', [], true);
    const remap = new TenantIdRemap();
    remap.markRemapped(TABLE);
    remap.set(TABLE, 1, 101);
    remap.set(TABLE, 7, 107);
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref]), remap);
    await rowInserter.insert({ id: 1, siblings: [7] });
    expect(JSON.parse(inserted().siblings as string)).toEqual([107]);
  });

  it('re-points a bare array of ids arriving as a JSON STRING ("[7]") — the SQLite-sourced shape', async () => {
    const ref = new TenantColumnReference(TABLE, 'siblings', TABLE, 'schema', [], true);
    const remap = new TenantIdRemap();
    remap.markRemapped(TABLE);
    remap.set(TABLE, 1, 101);
    remap.set(TABLE, 7, 107);
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref]), remap);
    await rowInserter.insert({ id: 1, siblings: '[7]' });
    expect(JSON.parse(inserted().siblings as string)).toEqual([107]);
  });

  it('re-points a relationship sub-field inside an array of objects ([{item: 7}])', async () => {
    const ref = new TenantColumnReference(TABLE, 'rules', TABLE, 'schema', ['item'], false, true);
    const remap = new TenantIdRemap();
    remap.markRemapped(TABLE);
    remap.set(TABLE, 1, 101);
    remap.set(TABLE, 7, 107);
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref]), remap);
    await rowInserter.insert({ id: 1, rules: [{ item: 7, pricingType: 'inherit' }] });
    expect(JSON.parse(inserted().rules as string)).toEqual([{ item: 107, pricingType: 'inherit' }]);
  });

  it('drops the whole element when its required sub-field is dangling, and warns', async () => {
    const ref = new TenantColumnReference(TABLE, 'rules', TABLE, 'schema', ['item'], false, true);
    const remap = new TenantIdRemap();
    remap.markRemapped(TABLE);
    remap.set(TABLE, 1, 101);
    // 99 has no mapping: the archive never carried it (or it was excluded).
    const warnings: string[] = [];
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref]), remap, warnings);
    await rowInserter.insert({ id: 1, rules: [{ item: 99, pricingType: 'inherit' }] });
    expect(JSON.parse(inserted().rules as string)).toEqual([]);
    expect(warnings.some((w) => w.includes('rules[].item') && w.includes(TABLE))).toBe(true);
  });

  it('nulls (never drops) a non-required sub-field when dangling', async () => {
    const ref = new TenantColumnReference(TABLE, 'rules', TABLE, 'schema', ['item'], false, false);
    const remap = new TenantIdRemap();
    remap.markRemapped(TABLE);
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref]), remap);
    await rowInserter.insert({ id: 1, rules: [{ item: 99, pricingType: 'inherit' }] });
    expect(JSON.parse(inserted().rules as string)).toEqual([{ item: null, pricingType: 'inherit' }]);
  });

  it('nulls a dangling plain scalar column reference', async () => {
    const ref = new TenantColumnReference(TABLE, 'category_id', 'fcp_widgets_categories', 'schema');
    const remap = new TenantIdRemap();
    remap.markRemapped('fcp_widgets_categories');
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref]), remap);
    await rowInserter.insert({ id: 1, category_id: 99 });
    expect(inserted().category_id).toBeNull();
  });

  it('preserve mode: leaves a bare array of ids untouched', async () => {
    const ref = new TenantColumnReference(TABLE, 'siblings', TABLE, 'schema', [], true);
    const remap = new TenantIdRemap(); // never marked remapped — preserve mode
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref]), remap);
    await rowInserter.insert({ id: 1, siblings: [7] });
    expect(JSON.parse(inserted().siblings as string)).toEqual([7]);
  });
});
