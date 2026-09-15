import { describe, expect, it, vi } from 'vitest';
import { TenantColumnPreparer } from '@core/tenant/provisioning/tenant-column-preparer';

/**
 * The columns adoption needs BEFORE it stamps anything.
 *
 * Adoption can only stamp a table that has a `tenant_id` column, and on a deployment whose tables
 * predate tenancy none of them do — the column arrives on the next boot, after adoption has run.
 * Measured on a real adoption: 20 rows across 8 tables left with no owner, hidden from every tenant
 * the moment isolation came on, while the adoption reported success.
 */
describe('TenantColumnPreparer — giving scoped tables their column before adoption', () => {
  // The preparer asks the DRIVER for the column now, so the fake is the capability, not a SQL sink.
  // What that column statement actually says is the dialect's own test
  // (dialects/postgres/tests/tenant-isolation-sql.test.ts), where the SQL lives.
  const dbWith = (tables: string[]) => {
    const prepared: string[] = [];
    const addTenantColumn = vi.fn(async (table: string) => { prepared.push(table); });
    return {
      prepared,
      addTenantColumn,
      db: {
        getTables: async () => tables,
        tenantIsolation: { addTenantColumn },
      },
    };
  };

  it('prepares a plugin content table', async () => {
    const { db } = dbWith(['fcp_cms_pages']);

    expect(await new TenantColumnPreparer(db).ensureColumns()).toBe(1);
    expect(db.tenantIsolation.addTenantColumn).toHaveBeenCalledWith('fcp_cms_pages');
  });

  it('prepares the framework tables that hold a tenant\'s own content', async () => {
    const { db } = dbWith(['people', '_system_redirects', 'media_folders']);

    expect(await new TenantColumnPreparer(db).ensureColumns()).toBe(3);
  });

  it('leaves platform configuration alone — the same rule the sweep applies', async () => {
    const { db } = dbWith(['users', '_system_tenants', '_system_meta']);

    expect(await new TenantColumnPreparer(db).ensureColumns()).toBe(0);
    expect(db.tenantIsolation.addTenantColumn).not.toHaveBeenCalled();
  });

  it('honours a collection declared system, whatever its table is called', async () => {
    const { db } = dbWith(['settings']);

    expect(await new TenantColumnPreparer(db).ensureColumns(new Set(['settings']))).toBe(0);
  });

  it('asks for the COLUMN only — never for enforcement', async () => {
    const { db, prepared } = dbWith(['fcp_cms_pages', 'fcp_cms_posts']);

    await new TenantColumnPreparer(db).ensureColumns();

    // One call per scoped table, and `addTenantColumn` is the half that does NOT enable row-level
    // security. Enforcing here would hide every row on a deployment that has no tenants yet — the
    // documented reason the boot sweep refuses to isolate anything until a tenant exists.
    expect(prepared).toEqual(['fcp_cms_pages', 'fcp_cms_posts']);
    expect(Object.keys(db.tenantIsolation)).toEqual(['addTenantColumn']);
  });
});
