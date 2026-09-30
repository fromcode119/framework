import { TenantMode } from '@fromcode119/core';
import { TenantAdminService } from '@api/services/tenants/tenant-admin-service';

/**
 * A database that cannot keep sites apart (setup's "single site only" choices) serves one site and
 * never gains a site row: with one present, the next boot refuses to start. Creating, importing and
 * adopting each write that row, so each is refused before anything is written.
 */

function buildService() {
  const db: any = { find: vi.fn(async () => []), queryRaw: vi.fn(async () => []), dialect: 'sqlite' };
  const manager: any = { db, schemaDb: db, registeredCollections: new Map(), getPlugins: () => [], hooks: { on: vi.fn(), emit: vi.fn() } };
  const service = new TenantAdminService(manager, { getThemes: () => [] } as any, '/tmp/uploads-under-test');
  const registry = { create: vi.fn(), count: vi.fn(async () => 0), list: vi.fn(async () => []) };
  (service as any).registry = registry;
  (service as any).record = vi.fn();
  (service as any).gateway = { notify: vi.fn() };
  return { service, registry };
}

afterEach(() => TenantMode.reset());

describe('adding a site on a single-site database', () => {
  beforeEach(() => TenantMode.configure({ tenantCount: 0, dialect: 'sqlite', isolationSupported: false }));

  it('refuses to create one, with nothing written', async () => {
    const { service, registry } = buildService();
    await expect(service.create({ slug: 'shop', primaryHost: 'shop.example.test' }, {})).rejects.toThrow(/keeps a single site/);
    expect(registry.create).not.toHaveBeenCalled();
  });

  it('refuses to adopt the deployment as one', async () => {
    const { service, registry } = buildService();
    await expect(service.adopt({ slug: 'shop', primaryHost: 'shop.example.test' }, {})).rejects.toThrow(/keeps a single site/);
    expect(registry.create).not.toHaveBeenCalled();
  });

  it('refuses to import one', async () => {
    const { service } = buildService();
    await expect(service.executeImport('/tmp/does-not-matter.tar.gz', {}, {})).rejects.toThrow(/keeps a single site/);
  });

  it('answers 409, not a server error', async () => {
    const { service } = buildService();
    await expect(service.create({ slug: 'shop' }, {})).rejects.toMatchObject({ statusCode: 409 });
  });

  it('says sites are not supported', () => {
    expect(buildService().service.sitesSupported).toBe(false);
  });
});

describe('a database that keeps sites apart', () => {
  it('says sites are supported, even before the first one exists', () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    expect(buildService().service.sitesSupported).toBe(true);
  });
});
