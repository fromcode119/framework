import { describe, expect, it } from 'vitest';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantIdRemapStore } from '@core/tenant/provisioning/tenant-id-remap-store';

/**
 * The map an import builds is worth keeping, because reconstructing it afterwards is the expensive
 * part.
 *
 * It was reconstructed once, for one tenant: match each archived row to its imported row on a
 * natural key and `created_at`, confirm every pair twice, emit 22,000 lines of literal SQL, rehearse
 * against a copy, run it by hand. That only worked because those collections happened to carry
 * natural keys — a table without one could not have been repaired at all. These tests are about the
 * cheap alternative being correct.
 */
describe('TenantIdRemapStore', () => {
  /** The SQL a statement carries, whether it arrived as a string or as a `sql.raw()` object. */
  const textOf = (statement: any): string => {
    if (typeof statement === 'string') return statement;
    const chunks = statement?.queryChunks ?? [];
    return chunks.map((chunk: any) => (chunk?.value ?? []).join('')).join('');
  };

  /** A database that records what it was asked to run, and answers from rows put in front of it. */
  const fakeDb = (rows: any[] = []) => {
    const executed: string[] = [];
    return {
      executed,
      // `sql.raw()` keeps its text in `queryChunks`, not on a `.sql` property — stringifying the
      // object itself yields "[object Object]" and a test that can never match.
      execute: async (statement: any) => { executed.push(textOf(statement)); return []; },
      queryRaw: async (statement: any) => { executed.push(String(statement)); return rows; },
    } as any;
  };

  const remapOf = (table: string, pairs: Array<[string, string]>): TenantIdRemap => {
    const remap = new TenantIdRemap();
    remap.markRemapped(table);
    for (const [oldId, newId] of pairs) remap.set(table, oldId, newId);
    return remap;
  };

  it('records one row per mapping, for the tables that were actually remapped', async () => {
    const db = fakeDb();
    const remap = remapOf('fcp_acme_orders', [['157', '554'], ['158', '555']]);

    expect(await new TenantIdRemapStore(db).record('acme', remap)).toBe(2);
    expect(db.executed.join(' ')).toContain("('acme', 'fcp_acme_orders', '157', '554')");
    expect(db.executed.join(' ')).toContain("('acme', 'fcp_acme_orders', '158', '555')");
  });

  /**
   * A table in "preserve" mode kept its ids, so it has nothing to say. Writing identity rows for it
   * would record that nothing happened, at the cost of tripling the table.
   */
  it('says nothing about a table whose ids were preserved', async () => {
    const db = fakeDb();
    const remap = new TenantIdRemap();
    remap.set('fcp_orbit_pages', '1', '1');

    expect(await new TenantIdRemapStore(db).record('acme', remap)).toBe(0);
    expect(db.executed).toHaveLength(0);
  });

  /**
   * The import is already committed when this runs. Losing the map costs a future repair; failing
   * the import would throw away a good one — so the failure is swallowed and warned about, and the
   * caller is told nothing was written.
   */
  it('does not fail the import when the map cannot be written', async () => {
    const db = fakeDb();
    db.execute = async () => { throw new Error('disk full'); };

    await expect(new TenantIdRemapStore(db).record('acme', remapOf('t', [['1', '2']])))
      .resolves.toBe(0);
  });

  it('answers what an old id became', async () => {
    const store = new TenantIdRemapStore(fakeDb([{ new_id: '554' }]));
    expect(await store.resolve('acme', 'fcp_acme_orders', '157')).toBe('554');
  });

  /** An id the archive never carried has no answer, and `null` is that answer — not the id itself. */
  it('answers null for an id it never saw, rather than echoing it back', async () => {
    const store = new TenantIdRemapStore(fakeDb([]));
    expect(await store.resolve('acme', 'fcp_acme_orders', '999')).toBeNull();
  });

  /**
   * A tenant imported twice holds both runs, ordered. The NEWEST answer is the right one: an id
   * re-mapped by a later import is where the row is now, which is what a repair needs to reach.
   */
  it('prefers the most recent import when a tenant was imported more than once', async () => {
    const db = fakeDb([{ new_id: '900' }]);
    await new TenantIdRemapStore(db).resolve('acme', 'fcp_acme_orders', '157');
    expect(db.executed.join(' ')).toContain('ORDER BY imported_at DESC');
  });

  it('rebuilds a usable TenantIdRemap from what was recorded', async () => {
    const db = fakeDb([
      { table_name: 'fcp_acme_orders', old_id: '157', new_id: '554' },
      { table_name: 'fcp_acme_orders', old_id: '158', new_id: '555' },
    ]);

    const remap = await new TenantIdRemapStore(db).load('acme');

    expect(remap.isRemapped('fcp_acme_orders')).toBe(true);
    expect(remap.resolve('fcp_acme_orders', '157')).toBe('554');
    // Unchanged for an id it never carried — the same contract the in-flight map has.
    expect(remap.resolve('fcp_acme_orders', '999')).toBe('999');
  });

  /**
   * These values are ids and table names the importer produced, not user input — but they are
   * concatenated into SQL, and "it cannot contain a quote" is the kind of assumption that stops
   * being true quietly.
   */
  it('escapes a quote rather than ending the literal', async () => {
    const db = fakeDb();
    await new TenantIdRemapStore(db).record("o'brien", remapOf('t', [["a'b", 'c']]));
    expect(db.executed.join(' ')).toContain("'o''brien'");
    expect(db.executed.join(' ')).toContain("'a''b'");
  });
});
