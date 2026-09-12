import { TenantRlsSql } from '@fromcode119/database';
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
  const dbWith = (tables: string[]) => {
    const executed: string[] = [];
    return {
      executed,
      db: {
        getTables: async () => tables,
        execute: vi.fn(async (statement: any) => {
          executed.push(String(statement?.sql ?? statement?.queryChunks ?? statement));
        }),
      },
    };
  };

  it('prepares a plugin content table', async () => {
    const { db } = dbWith(['fcp_cms_pages']);

    expect(await new TenantColumnPreparer(db).ensureColumns()).toBe(1);
    expect(db.execute).toHaveBeenCalled();
  });

  it('prepares the framework tables that hold a tenant\'s own content', async () => {
    const { db } = dbWith(['people', '_system_redirects', 'media_folders']);

    expect(await new TenantColumnPreparer(db).ensureColumns()).toBe(3);
  });

  it('leaves platform configuration alone — the same rule the sweep applies', async () => {
    const { db } = dbWith(['users', '_system_tenants', '_system_meta']);

    expect(await new TenantColumnPreparer(db).ensureColumns()).toBe(0);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('honours a collection declared system, whatever its table is called', async () => {
    const { db } = dbWith(['settings']);

    expect(await new TenantColumnPreparer(db).ensureColumns(new Set(['settings']))).toBe(0);
  });

  it('issues exactly the column statements, one pair per scoped table', async () => {
    const { db } = dbWith(['fcp_cms_pages']);

    await new TenantColumnPreparer(db).ensureColumns();

    expect(db.execute).toHaveBeenCalledTimes(TenantRlsSql.columnStatementsFor('fcp_cms_pages').length);
  });

  it('the statements it issues add the column and its index, and NEVER enable row-level security', () => {
    const statements = TenantRlsSql.columnStatementsFor('fcp_cms_pages').join(' ');

    expect(statements).toContain('ADD COLUMN IF NOT EXISTS');
    expect(statements).toContain('CREATE INDEX IF NOT EXISTS');
    // Enabling it here would hide every row on a deployment that has no tenants yet — the documented
    // reason the boot sweep refuses to isolate anything until a tenant exists.
    expect(statements).not.toContain('ROW LEVEL SECURITY');
    expect(statements).not.toContain('CREATE POLICY');
  });
});
