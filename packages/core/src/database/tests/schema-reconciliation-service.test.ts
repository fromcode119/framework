import { describe, expect, it, vi, afterEach } from 'vitest';
import { SchemaReconciliationService } from '@core/database/schema-reconciliation-service';
import { TenantMode } from '@core/tenant/tenant-mode';


/**
 * The CONTRACT half of expand/contract.
 *
 * The tests that matter most are the ones asserting it does NOT propose: a column reported as empty
 * because the connection could not see it is the single mistake that loses data, and FORCE row-level
 * security makes that the DEFAULT reading on every tenant-scoped table.
 */
describe('SchemaReconciliationService', () => {
  afterEach(() => vi.restoreAllMocks());

  const planFor = (columns: string[]) => ({
    tableName: 'fcp_lumen_invoices',
    undeclaredColumns: columns,
  } as any);

  /** A db that records what it was asked, and answers the column count with `stats`. */
  const dbWith = (stats: { rows: number; nonNull: number; sample: string }, rows: any[] = []) => {
    const written: any[] = [];
    const dropped: string[] = [];
    return {
      written,
      dropped,
      db: {
        withPlatformAdmin: async (fn: () => Promise<unknown>) => fn(),
        withTenant: async (_id: string, fn: () => Promise<unknown>) => fn(),
        tenantIds: ['t1', 't2'],
        columnStats: vi.fn(async () => stats),
        dropColumn: vi.fn(async (table: string, column: string) => { dropped.push(`${table}.${column}`); }),
        find: async (table: string) => (table === '_system_tenants' ? [{ id: 't1' }, { id: 't2' }] : rows),
        findOne: async () => null,
        insert: async (_table: string, row: any) => { written.push(row); return row; },
        update: async (_table: string, _where: any, row: any) => { written.push(row); return row; },
        delete: async () => true,
      } as any,
    };
  };

  it('records the column and when it was first seen', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const { db, written } = dbWith({ rows: 46, nonNull: 46, nonEmpty: 46, sample: '2026-05-15 07:58:15' });

    await new SchemaReconciliationService(db).record(planFor(['invoice_date']));

    expect(written).toHaveLength(1);
    const entry = JSON.parse(written[0].value);
    expect(entry).toMatchObject({ table: 'fcp_lumen_invoices', column: 'invoice_date' });
    expect(entry.firstSeenAt).toBeTruthy();
  });

  it('shows no counts when counting throws, rather than zeros', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const pending = { table: 'fcp_quill_clients', column: 'custom_rates', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const { db } = dbWith({ rows: 1, nonNull: 1, nonEmpty: 1, sample: 'x' }, [{ key: 'schema_orphan:x', value: JSON.stringify(pending) }]);
    db.columnStats = vi.fn(async () => { throw new Error('permission denied'); });

    const [entry] = await new SchemaReconciliationService(db).pendingWithCounts();

    expect(entry.rows).toBeUndefined();
  });

  it('never drops anything while recording — that is the whole point', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const { db, dropped } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' });

    await new SchemaReconciliationService(db).record(planFor(['token', 'invoice_date']));

    expect(dropped).toEqual([]);
    expect(db.dropColumn).not.toHaveBeenCalled();
  });

  it('refuses to drop a column that is not on the pending list', async () => {
    const { db, dropped } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' }, []);

    // Free-form DDL through this endpoint is the risk; only a column this deployment actually found
    // undeclared may be dropped.
    await expect(new SchemaReconciliationService(db).approve('users', 'password'))
      .rejects.toThrow(/not awaiting approval/);
    expect(dropped).toEqual([]);
  });

  it('drops a column that IS on the list, and forgets it afterwards', async () => {
    const pending = {
      table: 'fcp_lumen_invoices', column: 'invoice_date',
      rows: 46, nonNull: 46, sample: 'x', firstSeenAt: '2026-09-15T00:00:00.000Z',
    };
    const { db, dropped } = dbWith({ rows: 46, nonNull: 46, nonEmpty: 46, sample: 'x' }, [{ key: 'schema_orphan:x', value: JSON.stringify(pending) }]);

    const entry = await new SchemaReconciliationService(db).approve('fcp_lumen_invoices', 'invoice_date');

    expect(dropped).toEqual(['fcp_lumen_invoices.invoice_date']);
    expect(entry.nonNull).toBe(46);
  });

  it('keeps the original firstSeenAt across boots, so an ignored queue looks old', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const { db, written } = dbWith({ rows: 1, nonNull: 1, nonEmpty: 1, sample: 'x' });
    db.findOne = async () => ({
      value: JSON.stringify({ table: 'fcp_lumen_invoices', column: 'invoice_date', firstSeenAt: '2026-01-01T00:00:00.000Z' }),
    });

    await new SchemaReconciliationService(db).record(planFor(['invoice_date']));

    expect(JSON.parse(written[0].value).firstSeenAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('records only the NAME at boot — counting happens when an operator looks', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const { db, written } = dbWith({ rows: 9, nonNull: 9, nonEmpty: 9, sample: 'x' });

    await new SchemaReconciliationService(db).record(planFor(['provider_key']));

    // Counting during schema sync opened tenant scopes, whose release cleared the platform marker on
    // the pooled client and broke the untenanted `_system_meta` write that follows it.
    expect(db.columnStats).not.toHaveBeenCalled();
    const entry = JSON.parse(written[0].value);
    expect(entry.rows).toBeUndefined();
    expect(entry.nonNull).toBeUndefined();
  });

  it('counts on the READ path, summed across EVERY tenant', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    const pending = { table: 'fcp_quill_clients', column: 'custom_rates', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const { db } = dbWith({ rows: 5, nonNull: 4, nonEmpty: 3, sample: 'rate' }, [{ key: 'schema_orphan:x', value: JSON.stringify(pending) }]);

    const [entry] = await new SchemaReconciliationService(db).pendingWithCounts();

    // Two tenants of five rows each: reporting one tenant's five would understate the cost by half.
    expect(entry.rows).toBe(10);
    expect(entry.nonEmpty).toBe(6);
  });

  it('reports NOTHING when a single tenant cannot be counted', async () => {
    // A suspended or unreachable tenant counted as zero is how live data gets approved for deletion.
    // A partial total is worse than none, because nothing downstream can tell them apart.
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    const pending = { table: 'fcp_quill_clients', column: 'custom_rates', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const { db } = dbWith({ rows: 5, nonNull: 4, nonEmpty: 3, sample: 'rate' }, [{ key: 'schema_orphan:x', value: JSON.stringify(pending) }]);
    let call = 0;
    db.columnStats = vi.fn(async () => {
      call += 1;
      if (call === 2) throw new Error('connection timeout');
      return { rows: 5, nonNull: 4, nonEmpty: 3, sample: 'rate' };
    });

    const [entry] = await new SchemaReconciliationService(db).pendingWithCounts();

    expect(entry.rows).toBeUndefined();
    expect(entry.nonEmpty).toBeUndefined();
  });

  it('leaves the counts ABSENT when they cannot be trusted, rather than showing zero', async () => {
    // A zero reads as "safe to drop". Absent must render as "not counted".
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    const pending = { table: 'fcp_quill_clients', column: 'custom_rates', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const { db } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' }, [{ key: 'schema_orphan:x', value: JSON.stringify(pending) }]);
    // A deployment that reports no tenants at all describes nothing, whatever the column holds.
    db.find = async (table: string) => (table === '_system_tenants' ? [] : [{ key: 'schema_orphan:x', value: JSON.stringify(pending) }]);

    const [entry] = await new SchemaReconciliationService(db).pendingWithCounts();

    expect(entry.rows).toBeUndefined();
    expect(entry.nonNull).toBeUndefined();
  });

  it('carries the inactive plugins WITH the finding, not just in a log line', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const { db, written } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' });

    // A shop plugin declares `licenseProduct` on products only while a licence plugin is ACTIVE. Off, the
    // column looks undeclared while still holding every licence it ever issued — and the queue
    // outlives this boot, so the condition has to travel with the entry.
    await new SchemaReconciliationService(db).record(planFor(['license_product']), ['plugin-a', 'plugin-b']);

    expect(JSON.parse(written[0].value).inactivePluginsAtScan).toEqual(['plugin-a', 'plugin-b']);
  });

  it('records an empty caveat when every installed plugin was active', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const { db, written } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' });

    await new SchemaReconciliationService(db).record(planFor(['provider_key']), []);

    expect(JSON.parse(written[0].value).inactivePluginsAtScan).toEqual([]);
  });

  it('prunes an entry the sweep no longer finds — a stale one would be approved eventually', async () => {
    const stale = { table: 'fcp_orbit_pages', column: 'og_title', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const live = { table: 'fcp_quill_clients', column: 'custom_rates', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const deleted: any[] = [];
    const { db } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' }, [
      { key: 'schema_orphan:a', value: JSON.stringify(stale) },
      { key: 'schema_orphan:b', value: JSON.stringify(live) },
    ]);
    db.delete = async (_t: string, where: any) => { deleted.push(where.key); return true; };

    await new SchemaReconciliationService(db).prune(new Set(), new Set(['fcp_quill_clients.custom_rates']));

    expect(deleted).toEqual(['schema_orphan:fcp_orbit_pages.og_title']);
  });

  it('NEVER prunes a table whose audit FAILED', async () => {
    // No fresh answer is not the same as "no longer a finding". Forgetting on that basis would
    // quietly discard real debt the moment one collection failed to plan.
    const entry = { table: 'fcp_orbit_pages', column: 'og_title', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const deleted: any[] = [];
    const { db } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' }, [{ key: 'schema_orphan:a', value: JSON.stringify(entry) }]);
    db.delete = async (_t: string, where: any) => { deleted.push(where.key); return true; };

    await new SchemaReconciliationService(db).prune(new Set(['fcp_orbit_pages']), new Set());

    expect(deleted).toEqual([]);
  });

  it('prunes an entry for a table the sweep no longer sees AT ALL', async () => {
    // `media.shared` and `users.is_platform_admin` were recorded by an early build, then became
    // unreachable: not in the registered set, so never re-audited, so never pruned — live columns
    // parked in an approval queue with no path out. Forgetting a PROPOSAL loses nothing; if the debt
    // is real it is recorded again next sweep.
    const stranded = { table: 'media', column: 'shared', firstSeenAt: '2026-09-15T00:00:00.000Z' };
    const deleted: any[] = [];
    const { db } = dbWith({ rows: 0, nonNull: 0, nonEmpty: 0, sample: '' }, [{ key: 'schema_orphan:a', value: JSON.stringify(stranded) }]);
    db.delete = async (_t: string, where: any) => { deleted.push(where.key); return true; };

    await new SchemaReconciliationService(db).prune(new Set(), new Set());

    expect(deleted).toEqual(['schema_orphan:media.shared']);
  });
});
