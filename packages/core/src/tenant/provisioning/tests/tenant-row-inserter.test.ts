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

  // Regression: PR #47 widened repointAt's string-decode branch to arrays, but only ever returned
  // the PARSED result — a `text` destination column that stored a JSON array as a STRING got a
  // live JS array back, which the pg driver then serialised as a Postgres ARRAY LITERAL
  // ({"{\"...\"}"}) instead of JSON. This is the corruption measured on the live platform.
  it('re-points ids inside a JSON array stored in a TEXT column, and keeps it a STRING', async () => {
    const ref = new TenantColumnReference(TABLE, 'items', TABLE, 'schema', ['page'], false, false);
    const remap = new TenantIdRemap();
    remap.markRemapped(TABLE);
    remap.set(TABLE, 1, 101);
    remap.set(TABLE, 7, 107);
    const { inserter: rowInserter, inserted } = inserter(descriptor([ref], { items: 'text' }), remap);
    await rowInserter.insert({ id: 1, items: '[{"label":"Home","page":7}]' });
    const written = inserted().items;
    expect(typeof written).toBe('string');
    expect(JSON.parse(written as string)).toEqual([{ label: 'Home', page: 107 }]);
  });

  // Regression, other route into the same bug: a JSONB SOURCE column landing in a TEXT destination
  // arrives as a live JS array, never a string, so repointAt's string branch never runs. encode()
  // must still refuse to hand the driver a bare array/object for a text column.
  it('stringifies a live array landing in a TEXT destination (jsonb source -> text destination)', async () => {
    const remap = new TenantIdRemap();
    const { inserter: rowInserter, inserted } = inserter(descriptor([], { levelRates: 'text' }), remap);
    await rowInserter.insert({ id: 1, levelRates: [{ level: 1, rate: 10 }] });
    const written = inserted().levelRates;
    expect(typeof written).toBe('string');
    expect(JSON.parse(written as string)).toEqual([{ level: 1, rate: 10 }]);
  });

  it('does not double-encode a value that is already a string for a TEXT destination', async () => {
    const remap = new TenantIdRemap();
    const { inserter: rowInserter, inserted } = inserter(descriptor([], { note: 'text' }), remap);
    await rowInserter.insert({ id: 1, note: 'plain text, not json' });
    expect(inserted().note).toBe('plain text, not json');
  });
});

/**
 * An empty string is a VALUE in a character column and an ABSENCE everywhere else — so which types
 * count as "character" decides whether data survives the import. The predicate used to be spelled
 * inline here as `text` or `character varying`, while the id repair spelled the same property with
 * `character` included. `char(n)` therefore looked non-textual and its empty strings were rewritten.
 */
describe('TenantRowInserter — empty strings by column type', () => {
  it("keeps '' in a character(n) column, where it is a value rather than an absence", async () => {
    const { inserter: rowInserter, inserted } = inserter(
      descriptor([], { code: 'character' }),
      new TenantIdRemap(),
    );
    await rowInserter.insert({ id: 1, code: '' });
    expect(inserted().code).toBe('');
  });

  it("keeps '' in text and character varying", async () => {
    const { inserter: rowInserter, inserted } = inserter(
      descriptor([], { note: 'text', label: 'character varying' }),
      new TenantIdRemap(),
    );
    await rowInserter.insert({ id: 1, note: '', label: '' });
    expect(inserted().note).toBe('');
    expect(inserted().label).toBe('');
  });

  it("still nulls '' in a NON-character column, which is what the rule is for", async () => {
    const { inserter: rowInserter, inserted } = inserter(
      descriptor([], { due_at: 'date' }),
      new TenantIdRemap(),
    );
    await rowInserter.insert({ id: 1, due_at: '' });
    expect(inserted().due_at).toBeNull();
  });
});
