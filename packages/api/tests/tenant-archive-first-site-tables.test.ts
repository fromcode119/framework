import { TenantColumnPreparer, TenantMode, TenantTableCatalog } from '@fromcode119/core';
import { TenantAdminService } from '@api/services/tenants/tenant-admin-service';

/**
 * Which tables a site's rows live in. With sites on, the tables under a site policy. Before the first
 * site the boot sweep has released every policy, so listing by policy found nothing and importing the
 * first site planned to skip every row — its settings, media and people.
 */

function buildService() {
  const db: any = { find: vi.fn(async () => []), queryRaw: vi.fn(async () => []), dialect: 'postgres' };
  const manager: any = { db, schemaDb: db, registeredCollections: new Map(), getPlugins: () => [], systemCollectionTables: () => new Set(['media']), hooks: { on: vi.fn(), emit: vi.fn() } };
  return new TenantAdminService(manager, { getThemes: () => [] } as any, '/tmp/uploads-under-test');
}

afterEach(() => { TenantMode.reset(); vi.restoreAllMocks(); });

describe('the tables an import plans against', () => {
  it('before the first site: the tables carrying the site column, given it first', async () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    const prepare = vi.spyOn(TenantColumnPreparer.prototype, 'ensureColumns').mockResolvedValue(0 as any);
    const byColumn = vi.spyOn(TenantTableCatalog.prototype, 'byColumn').mockResolvedValue([]);
    const byPolicy = vi.spyOn(TenantTableCatalog.prototype, 'byPolicy').mockResolvedValue([]);

    await (buildService() as any).tables();

    expect(prepare).toHaveBeenCalled();
    expect(byColumn).toHaveBeenCalled();
    expect(byPolicy).not.toHaveBeenCalled();
  });

  it('with sites on: the tables under a site policy', async () => {
    TenantMode.configure({ tenantCount: 1, dialect: 'postgres', isolationSupported: true });
    const byColumn = vi.spyOn(TenantTableCatalog.prototype, 'byColumn').mockResolvedValue([]);
    const byPolicy = vi.spyOn(TenantTableCatalog.prototype, 'byPolicy').mockResolvedValue([]);

    await (buildService() as any).tables();

    expect(byPolicy).toHaveBeenCalled();
    expect(byColumn).not.toHaveBeenCalled();
  });
});
