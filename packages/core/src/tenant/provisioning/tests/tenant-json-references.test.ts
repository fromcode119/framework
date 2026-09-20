import { describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantJsonReferences } from '@core/tenant/provisioning/tenant-json-references';
import { TenantRowInserter } from '@core/tenant/provisioning/tenant-row-inserter';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

const ORDERS = 'fcp_acme_orders';
const PRODUCTS = 'fcp_acme_products';
const COLUMNS: Record<string, string> = { id: 'integer', tenant_id: 'text', items: 'jsonb', metadata: 'jsonb', notes: 'text' };

function collection(fields: unknown[]): { collection: never; pluginSlug: string } {
  return { collection: { tableName: ORDERS, fields } as never, pluginSlug: 'ecommerce' };
}

function references(fields: unknown[]) {
  const columns = new Map([[ORDERS, COLUMNS], [PRODUCTS, { id: 'integer' }]]);
  return TenantJsonReferences.forCollections([collection(fields)], new Set([ORDERS]), columns, (relationTo) => (relationTo.includes('product') ? PRODUCTS : null)).get(ORDERS) ?? [];
}

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

const ITEMS_FIELD = { name: 'items', type: 'json', jsonReferences: [{ path: ['id'], relationTo: 'ecommerce-products' }] };

describe('TenantJsonReferences — declaration', () => {
  it('turns a declared json path into a reference the remap follows', () => {
    const [ref] = references([ITEMS_FIELD]);
    expect(ref.column).toBe('items');
    expect(ref.path).toEqual(['id']);
    expect(ref.targetTable).toBe(PRODUCTS);
    expect(ref.describe()).toBe('items[].id');
  });

  it('ignores a declaration on a column that is not JSON here', () => {
    expect(references([{ name: 'notes', type: 'json', jsonReferences: [{ path: ['id'], relationTo: 'ecommerce-products' }] }])).toEqual([]);
  });

  it('ignores a declaration whose target does not resolve', () => {
    expect(references([{ name: 'items', type: 'json', jsonReferences: [{ path: ['id'], relationTo: 'nothing-here' }] }])).toEqual([]);
  });

  it('declares nothing for a json field that declared nothing — metadata stays opaque', () => {
    expect(references([{ name: 'metadata', type: 'json' }])).toEqual([]);
  });
});

describe('TenantRowInserter — a declared json reference', () => {
  function build(remap: TenantIdRemap) {
    const { db, inserted } = fakeDb();
    const table = new TenantTableDescriptor(ORDERS, COLUMNS, true, `${ORDERS}_id_seq`, references([ITEMS_FIELD]));
    return { rowInserter: new TenantRowInserter(db, table, 't1', remap, new TenantImportFiles('/tmp/fc-test-uploads'), []), inserted };
  }

  it('re-points every order line, keeping the string shape the archive wrote', async () => {
    const remap = new TenantIdRemap();
    remap.markRemapped(PRODUCTS);
    remap.set(PRODUCTS, 6, 48);
    remap.set(PRODUCTS, 9, 51);
    remap.markRemapped(ORDERS);
    remap.set(ORDERS, 1, 700);
    const { rowInserter, inserted } = build(remap);
    await rowInserter.insert({
      id: 1,
      items: [{ id: '6', name: 'Табло на мечтите', quantity: 1 }, { id: '9', name: 'Нумерология', quantity: 2 }],
      metadata: { importedProductId: 6, legacyOrderId: 299, formFields: { cityId: 7 } },
    });
    const items = JSON.parse(inserted().items as string);
    expect(items.map((item: { id: string }) => item.id)).toEqual(['48', '51']);
    expect(items[0].name).toBe('Табло на мечтите');
  });

  it('leaves metadata alone — a legacy id and a courier city id are NOT this platform\'s ids', async () => {
    const remap = new TenantIdRemap();
    remap.markRemapped(PRODUCTS);
    remap.set(PRODUCTS, 6, 48);
    remap.set(PRODUCTS, 7, 49);
    remap.markRemapped(ORDERS);
    remap.set(ORDERS, 1, 700);
    const { rowInserter, inserted } = build(remap);
    await rowInserter.insert({ id: 1, items: [], metadata: { importedProductId: 6, legacyOrderId: 299, formFields: { cityId: 7 } } });
    expect(JSON.parse(inserted().metadata as string)).toEqual({ importedProductId: 6, legacyOrderId: 299, formFields: { cityId: 7 } });
  });
});
