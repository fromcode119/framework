import { describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantColumnSource } from '@core/tenant/provisioning/enums/tenant-column-source.enum';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantPolymorphicReferences } from '@core/tenant/provisioning/tenant-polymorphic-references';
import { TenantRowInserter } from '@core/tenant/provisioning/tenant-row-inserter';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

const VERSIONS = SystemConstants.TABLE.RECORD_VERSIONS;
const PRODUCTS = 'fcp_ecommerce_products';
const PAGES = 'fcp_cms_pages';

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

const COLUMNS: Record<string, string> = {
  id: 'integer', tenant_id: 'text', ref_id: 'character varying', ref_collection: 'character varying', version_data: 'jsonb',
};

function versionsDescriptor(): TenantTableDescriptor {
  const references = TenantPolymorphicReferences.forTables(new Set([VERSIONS]), new Map([[VERSIONS, COLUMNS]])).get(VERSIONS) ?? [];
  return new TenantTableDescriptor(VERSIONS, COLUMNS, true, `${VERSIONS}_id_seq`, references);
}

function build(remap: TenantIdRemap, warnings: string[] = []) {
  const { db, inserted } = fakeDb();
  const table = versionsDescriptor();
  return { table, rowInserter: new TenantRowInserter(db, table, 't1', remap, new TenantImportFiles('/tmp/fc-test-uploads'), warnings), inserted };
}

describe('TenantPolymorphicReferences — declaration', () => {
  it('declares ref_id against the table ref_collection names', () => {
    const [ref] = TenantPolymorphicReferences.forTables(new Set([VERSIONS]), new Map([[VERSIONS, COLUMNS]])).get(VERSIONS) ?? [];
    expect(ref.column).toBe('ref_id');
    expect(ref.targetTableColumn).toBe('ref_collection');
    expect(ref.isPolymorphic).toBe(true);
    expect(ref.source).toBe(TenantColumnSource.POLYMORPHIC);
    expect(ref.describeTarget()).toBe('the table named by "ref_collection"');
  });

  it('declares nothing when the row carries no column naming the target', () => {
    const withoutType = new Map([[VERSIONS, { id: 'integer', ref_id: 'character varying' }]]);
    expect(TenantPolymorphicReferences.forTables(new Set([VERSIONS]), withoutType).size).toBe(0);
  });

  it('contributes no dependency edge — the target varies per row', () => {
    expect(versionsDescriptor().dependsOn).toEqual([]);
    expect(versionsDescriptor().selfReferences).toEqual([]);
  });
});

describe('TenantRowInserter — polymorphic re-pointing', () => {
  it('re-points ref_id through the remap of the table ref_collection names', async () => {
    const remap = new TenantIdRemap();
    remap.markRemapped(PRODUCTS);
    remap.set(PRODUCTS, 11, 54);
    remap.markRemapped(VERSIONS);
    remap.set(VERSIONS, 1, 900);
    const { rowInserter, inserted } = build(remap);
    await rowInserter.insert({ id: 1, ref_id: '11', ref_collection: PRODUCTS });
    // The column is varchar: the new id has to arrive as a STRING, as the old one did.
    expect(inserted().ref_id).toBe('54');
    expect(inserted().ref_collection).toBe(PRODUCTS);
  });

  it('follows a DIFFERENT table for a different row of the same import', async () => {
    const remap = new TenantIdRemap();
    remap.markRemapped(PRODUCTS);
    remap.set(PRODUCTS, 11, 54);
    remap.markRemapped(PAGES);
    remap.set(PAGES, 11, 302);
    remap.markRemapped(VERSIONS);
    remap.set(VERSIONS, 1, 900);
    remap.set(VERSIONS, 2, 901);
    const { rowInserter, inserted } = build(remap);
    await rowInserter.insert({ id: 1, ref_id: '11', ref_collection: PRODUCTS });
    expect(inserted().ref_id).toBe('54');
    await rowInserter.insert({ id: 2, ref_id: '11', ref_collection: PAGES });
    expect(inserted().ref_id).toBe('302');
  });

  it('leaves ref_id alone when the named table was NOT re-numbered', async () => {
    const remap = new TenantIdRemap();
    remap.markRemapped(VERSIONS);
    remap.set(VERSIONS, 1, 900);
    const { rowInserter, inserted } = build(remap);
    await rowInserter.insert({ id: 1, ref_id: '11', ref_collection: PRODUCTS });
    expect(inserted().ref_id).toBe('11');
  });

  it('leaves ref_id alone when ref_collection is empty', async () => {
    const remap = new TenantIdRemap();
    remap.markRemapped(PRODUCTS);
    remap.set(PRODUCTS, 11, 54);
    remap.markRemapped(VERSIONS);
    remap.set(VERSIONS, 1, 900);
    const { rowInserter, inserted } = build(remap);
    await rowInserter.insert({ id: 1, ref_id: '11', ref_collection: '' });
    expect(inserted().ref_id).toBe('11');
  });

  it('clears and reports a ref_id the archive carries no record for', async () => {
    const remap = new TenantIdRemap();
    remap.markRemapped(PRODUCTS);
    remap.set(PRODUCTS, 11, 54);
    remap.markRemapped(VERSIONS);
    remap.set(VERSIONS, 1, 900);
    const warnings: string[] = [];
    const { rowInserter, inserted } = build(remap, warnings);
    await rowInserter.insert({ id: 1, ref_id: '99', ref_collection: PRODUCTS });
    expect(inserted().ref_id).toBeNull();
    expect(warnings.join(' ')).toContain('ref_id');
  });
});
