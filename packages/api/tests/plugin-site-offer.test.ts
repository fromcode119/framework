import { PluginOwners, PluginTenantAccess, SystemConstants, TenantMode } from '@fromcode119/core';
import { PluginSiteOfferController } from '@api/controllers/plugins/plugin-site-offer-controller';

/**
 * A site may switch on, for itself, only the plugins the platform OFFERS — reviewed code the platform
 * installed and approved. Everything else stays the platform's to assign.
 */
describe('plugins offered to sites', () => {
  afterEach(() => { TenantMode.reset(); PluginTenantAccess.reset(); PluginOwners.forget('guestbook'); });
  const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

  /** `_system_meta` and `_system_tenant_plugins` in memory, as the raw manager would answer them. */
  const database = () => {
    const meta = new Map<string, string>();
    const sitePlugins: Array<Record<string, any>> = [];
    const db: any = {
      withPlatformAdmin: (fn: () => unknown) => fn(),
      findOne: async (table: string, where: any) => table === SystemConstants.TABLE.META
        ? (meta.has(where.key) ? { key: where.key, value: meta.get(where.key) } : null)
        : sitePlugins.find((row) => row.tenant_id === where.tenant_id && row.plugin_slug === where.plugin_slug) ?? null,
      find: async (_table: string, query: any) => sitePlugins.filter((row) => row.tenant_id === query?.where?.tenant_id),
      insert: async (table: string, row: any) => { if (table === SystemConstants.TABLE.META) meta.set(row.key, row.value); else sitePlugins.push({ ...row }); },
      update: async (table: string, where: any, patch: any) => {
        if (table === SystemConstants.TABLE.META) { meta.set(where.key, patch.value); return; }
        Object.assign(sitePlugins.find((row) => row.tenant_id === where.tenant_id && row.plugin_slug === where.plugin_slug) ?? {}, patch);
      },
    };
    return { db, meta, sitePlugins };
  };
  let materialized = 0;
  const managerWith = (db: any, plugins: Record<string, string>) => ({
    db,
    materializeDefaultPages: async () => { materialized += 1; },
    plugins: new Map(Object.entries(plugins).map(([slug, state]) => [slug, { state, manifest: { slug, name: slug.toUpperCase(), version: '1.0.0', description: `${slug} plugin` } }])),
  } as any);
  const request = (tenantId: string | null, slug = '', body: Record<string, unknown> = {}) => ({ params: { slug }, body, query: {}, ...(tenantId ? { tenantId } : {}) } as any);
  const response = () => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (payload: unknown) => { res.body = payload; return res; };
    return res;
  };

  it('keeps the offered list, and a row it cannot read offers nothing', async () => {
    multiTenant();
    const { db, meta } = database();
    const controller = new PluginSiteOfferController(managerWith(db, { forms: 'active', seo: 'active' }));
    await controller.setOffer(request(null, 'forms', { offered: true }), response());
    await controller.setOffer(request(null, 'seo', { offered: true }), response());
    await controller.setOffer(request(null, 'forms', { offered: false }), response());
    const res = response();
    await controller.offered(request(null), res);
    expect(res.body).toEqual({ offered: ['seo'] });

    meta.set('plugins:offered_to_sites', 'not json');
    const broken = response();
    await controller.offered(request(null), broken);
    expect(broken.body).toEqual({ offered: [] });
  });

  it('shows a site only offered plugins that run on the platform, and whether each is on there', async () => {
    multiTenant();
    const { db, sitePlugins } = database();
    const controller = new PluginSiteOfferController(managerWith(db, { forms: 'active', seo: 'inactive', gamma: 'active' }));
    for (const slug of ['forms', 'seo']) await controller.setOffer(request(null, slug, { offered: true }), response());
    sitePlugins.push({ tenant_id: 'site-a', plugin_slug: 'forms', state: 'active' });
    const res = response();
    await controller.offered(request('site-a'), res);
    expect(res.body.plugins).toEqual([{ slug: 'forms', name: 'FORMS', description: 'forms plugin', version: '1.0.0', enabledHere: true }]);
  });

  it('lets a site switch an offered plugin on and off for itself only', async () => {
    multiTenant();
    const { db, sitePlugins } = database();
    const controller = new PluginSiteOfferController(managerWith(db, { forms: 'active' }));
    await controller.setOffer(request(null, 'forms', { offered: true }), response());

    materialized = 0;
    const on = response();
    await controller.setForSite(request('site-a', 'forms', { enabled: true }), on);
    expect(on.body).toEqual({ success: true, enabled: true });
    // Its default pages are created for the site now, not at the next restart.
    expect(materialized).toBe(1);
    expect(sitePlugins).toEqual([expect.objectContaining({ tenant_id: 'site-a', plugin_slug: 'forms', state: 'active' })]);

    await controller.setForSite(request('site-a', 'forms', { enabled: false }), response());
    expect(sitePlugins[0].state).toBe('inactive');
    expect(materialized).toBe(1);
  });

  it('refuses a plugin the platform does not offer, a stopped one, and a request with no site', async () => {
    multiTenant();
    const { db, sitePlugins } = database();
    const controller = new PluginSiteOfferController(managerWith(db, { gamma: 'active', seo: 'inactive' }));
    await controller.setOffer(request(null, 'seo', { offered: true }), response());

    const notOffered = response();
    await controller.setForSite(request('site-a', 'gamma', { enabled: true }), notOffered);
    expect(notOffered.statusCode).toBe(403);
    const stopped = response();
    await controller.setForSite(request('site-a', 'seo', { enabled: true }), stopped);
    expect(stopped.statusCode).toBe(409);
    const noSite = response();
    await controller.setForSite(request(null, 'seo', { enabled: true }), noSite);
    expect(noSite.statusCode).toBe(400);
    expect(sitePlugins).toEqual([]);
  });

  it('cannot offer a plugin that is not installed', async () => {
    multiTenant();
    const { db } = database();
    const res = response();
    await new PluginSiteOfferController(managerWith(db, {})).setOffer(request(null, 'ghost', { offered: true }), res);
    expect(res.statusCode).toBe(404);
  });

  it('lists a site\'s own plugins to that site only, and never lets the platform offer one to others', async () => {
    multiTenant();
    PluginOwners.record('guestbook', 'site-a');
    const { db } = database();
    const controller = new PluginSiteOfferController(managerWith(db, { guestbook: 'active', forms: 'active' }));

    const offer = response();
    await controller.setOffer(request(null, 'guestbook', { offered: true }), offer);
    expect(offer.statusCode).toBe(409);

    const mine = response();
    await controller.offered(request('site-a'), mine);
    expect(mine.body.own.map((plugin: any) => plugin.slug)).toEqual(['guestbook']);
    const theirs = response();
    await controller.offered(request('site-b'), theirs);
    expect(theirs.body.own).toEqual([]);

    const onHere = response();
    await controller.setForSite(request('site-a', 'guestbook', { enabled: true }), onHere);
    expect(onHere.body).toEqual({ success: true, enabled: true });
    const onThere = response();
    await controller.setForSite(request('site-b', 'guestbook', { enabled: true }), onThere);
    expect(onThere.statusCode).toBe(403);
  });
});
