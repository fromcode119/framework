import { TenantMode } from '@fromcode119/core';
import { ThemeController } from '@api/controllers/themes/theme-controller';

/**
 * A site adding a theme from the platform's marketplace: reviewed packages only, installed once and
 * shared, then made one of THIS site's themes. The shared copy is never updated from a site, and another
 * site's own theme name cannot be taken this way.
 */
describe('adding a marketplace theme to a site', () => {
  afterEach(() => { TenantMode.reset(); });
  const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

  const managerWith = (installed: Array<{ slug: string; version?: string; ownerTenantId?: string }>, marketplace: Array<{ slug: string; version: string }>) => ({
    getThemes: () => installed.map((theme) => ({ name: theme.slug, version: '1.0.0', ...theme })),
    getMarketplaceThemes: vi.fn(async () => marketplace),
    installTheme: vi.fn(async () => undefined),
    installFromZip: vi.fn(async () => undefined),
    assignToTenant: vi.fn(async () => undefined),
  } as any);
  const request = (tenantId: string | null, slug: string) => ({ params: { slug }, query: {}, body: {}, ...(tenantId ? { tenantId } : {}) } as any);
  const response = () => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (payload: unknown) => { res.body = payload; return res; };
    return res;
  };

  it('assigns an installed platform theme and never reinstalls or updates the shared copy', async () => {
    multiTenant();
    const manager = managerWith([{ slug: 'aurora', version: '1.0.0' }], [{ slug: 'aurora', version: '2.0.0' }]);
    const res = response();
    await new ThemeController(manager).addToSite(request('site-a', 'aurora'), res);
    expect(res.body).toEqual({ success: true, installed: false });
    expect(manager.installTheme).not.toHaveBeenCalled();
    expect(manager.assignToTenant).toHaveBeenCalledWith('aurora', 'site-a');
  });

  it('installs a theme the platform does not have yet from the marketplace, then assigns it', async () => {
    multiTenant();
    const manager = managerWith([], [{ slug: 'nocturne', version: '1.2.0' }]);
    const res = response();
    await new ThemeController(manager).addToSite(request('site-a', 'nocturne'), res);
    expect(res.body).toEqual({ success: true, installed: true });
    expect(manager.installTheme).toHaveBeenCalledWith(expect.objectContaining({ slug: 'nocturne' }));
    expect(manager.assignToTenant).toHaveBeenCalledWith('nocturne', 'site-a');
  });

  it('refuses a theme the marketplace does not offer, assigning nothing', async () => {
    multiTenant();
    const manager = managerWith([], []);
    const res = response();
    await new ThemeController(manager).addToSite(request('site-a', 'made-up'), res);
    expect(res.statusCode).toBe(404);
    expect(manager.assignToTenant).not.toHaveBeenCalled();
  });

  it("refuses another site's own theme name", async () => {
    multiTenant();
    const manager = managerWith([{ slug: 'theirs', ownerTenantId: 'site-b' }], [{ slug: 'theirs', version: '1.0.0' }]);
    const res = response();
    await new ThemeController(manager).addToSite(request('site-a', 'theirs'), res);
    expect(res.statusCode).toBe(409);
    expect(manager.assignToTenant).not.toHaveBeenCalled();
    expect(manager.installTheme).not.toHaveBeenCalled();
  });

  it('is a site action: in Platform scope there is no site to add it to', async () => {
    multiTenant();
    const manager = managerWith([], [{ slug: 'aurora', version: '1.0.0' }]);
    const res = response();
    await new ThemeController(manager).addToSite(request(null, 'aurora'), res);
    expect(res.statusCode).toBe(400);
    expect(manager.installTheme).not.toHaveBeenCalled();
  });
});
