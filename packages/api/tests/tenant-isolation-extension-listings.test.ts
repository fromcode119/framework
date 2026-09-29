import { PluginTenantAccess, TenantMode, TenantThemeAccess } from '@fromcode119/core';
import { PluginController } from '@api/controllers/plugins/plugin-controller';
import { ThemeController } from '@api/controllers/themes/theme-controller';

/**
 * A tenant is isolated from every other tenant — platform admin included.
 *
 * These are the first tests over these listings. Their absence is why the theme filter could be
 * deleted and leave nothing behind but an unused import: every leak asserted below was live in the
 * product, and no suite went red. Each test names the leak rather than the implementation, so a
 * later refactor that reopens one fails here instead of in a customer's admin.
 *
 * The axis under test is ALWAYS "is a tenant bound to this request", never "who is asking". A test
 * that passed only for a non-platform caller would re-encode the `platformAdmin ||` bypass this work
 * removed — so no test here configures a caller at all.
 */

const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

/** The two shapes a request reaches these handlers in: bound to one site, or in platform scope. */
const boundTo = (tenantId: string) => ({ query: {}, tenantId } as any);
const platformScope = () => ({ query: {} } as any);

function capture() {
  const res: any = { body: undefined };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

/** Both tenant tables are read through the RAW manager, so the fixtures carry snake_case columns. */
const rowsByTenant = (store: Record<string, Array<Record<string, unknown>>>) => ({
  find: vi.fn(async (_table: string, query: any) => store[String(query?.where?.tenant_id)] ?? []),
} as any);

afterEach(() => { TenantMode.reset(); TenantThemeAccess.reset(); PluginTenantAccess.reset(); });

describe("the plugin list is the site's assignment, never the platform catalogue", () => {
  const managerWith = (slugs: string[]) => ({
    getSortedPlugins: () => slugs.map((slug) => ({ manifest: { slug, name: slug }, state: 'active' })),
    discoverPlugins: vi.fn(),
    // The list names each plugin in the console's language; no language set here, so names stay as declared.
    db: { find: async () => [] },
    i18n: { translateOrFallback: () => '' },
  } as any);

  it('hides a product this site does not run, with no regard for who is asking', async () => {
    multiTenant();
    PluginTenantAccess.configure(rowsByTenant({ 'site-a': [{ plugin_slug: 'alpha', state: 'active' }] }));
    await PluginTenantAccess.warm('site-a');
    const res = capture();

    await new PluginController(managerWith(['alpha', 'beta', 'gamma'])).list(boundTo('site-a'), res);

    // `beta` and `gamma` are other customers' products on the same box. Nothing about the caller's
    // own access may put them back on this list — that bypass is what this asserts is gone.
    expect(res.body.map((entry: any) => entry.manifest.slug)).toEqual(['alpha']);
  });

  it('still answers the full catalogue in PLATFORM scope, where the operator decides assignments', async () => {
    multiTenant();
    PluginTenantAccess.configure(rowsByTenant({}));
    const res = capture();

    await new PluginController(managerWith(['alpha', 'beta'])).list(platformScope(), res);

    expect(res.body.map((entry: any) => entry.manifest.slug)).toEqual(['alpha', 'beta']);
  });
});

describe("the theme list is the site's assigned themes, never every theme on disk", () => {
  const managerWith = (slugs: string[]) => ({
    getThemes: () => slugs.map((slug) => ({ slug, name: slug, version: '1.0.0', state: 'inactive' })),
  } as any);

  it('hides an installed theme the site was never assigned — the listing that had NO filter at all', async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({ 'site-a': [{ theme_slug: 'aurora', state: 'active' }] }));
    const res = capture();

    await new ThemeController(managerWith(['aurora', 'basic', 'nocturne'])).list(boundTo('site-a'), res);

    // An unassigned theme's manifest discloses its author, its updateUrl and which plugins it
    // depends on — the platform's inventory, read off a shared box by one of its customers.
    expect(res.body.map((entry: any) => entry.slug)).toEqual(['aurora']);
  });

  it('keeps a RETIRED theme on the list: switching away leaves the row, and that row is what a site switches back to', async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({
      'site-a': [{ theme_slug: 'aurora', state: 'active' }, { theme_slug: 'basic', state: 'inactive' }],
    }));
    const res = capture();

    await new ThemeController(managerWith(['aurora', 'basic', 'nocturne'])).list(boundTo('site-a'), res);

    expect(res.body.map((entry: any) => entry.slug).sort()).toEqual(['aurora', 'basic']);
  });

  it('shows a site with no assigned theme NOTHING, rather than failing open to the whole disk', async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({}));
    const res = capture();

    await new ThemeController(managerWith(['aurora', 'basic'])).list(boundTo('site-a'), res);

    expect(res.body).toEqual([]);
  });

  it('shows NOTHING when the assignment read fails, rather than the platform set', async () => {
    multiTenant();
    TenantThemeAccess.configure({ find: vi.fn(async () => { throw new Error('connection lost'); }) } as any);
    const res = capture();

    await new ThemeController(managerWith(['aurora', 'basic'])).list(boundTo('site-a'), res);

    expect(res.body).toEqual([]);
  });

  it('still answers every installed theme in PLATFORM scope, which is where one is assigned', async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({}));
    const res = capture();

    await new ThemeController(managerWith(['aurora', 'basic'])).list(platformScope(), res);

    expect(res.body.map((entry: any) => entry.slug)).toEqual(['aurora', 'basic']);
  });

  it('leaves a SINGLE-TENANT deployment alone — there is no tenant to be isolated from', async () => {
    TenantThemeAccess.configure(rowsByTenant({}));
    const res = capture();

    await new ThemeController(managerWith(['aurora', 'basic'])).list(boundTo('site-a'), res);

    expect(res.body.map((entry: any) => entry.slug)).toEqual(['aurora', 'basic']);
  });
});

describe("a site's own themes are its own, and no theme it may not use can be acted on", () => {
  /** `owners` maps a slug to the site that uploaded it; absent means the platform owns it. */
  const managerWith = (slugs: string[], owners: Record<string, string> = {}) => ({
    getThemes: () => slugs.map((slug) => ({ slug, name: slug, version: '1.0.0', state: 'inactive', ...(owners[slug] ? { ownerTenantId: owners[slug] } : {}) })),
    activateTheme: vi.fn(async () => undefined),
    disableTheme: vi.fn(async () => undefined),
    resetTheme: vi.fn(async () => undefined),
    getThemeConfig: vi.fn(async () => ({})),
    saveThemeConfig: vi.fn(async () => undefined),
  } as any);
  const acting = (tenantId: string | null, slug: string) => ({ query: {}, params: { slug }, body: {}, ...(tenantId ? { tenantId } : {}) } as any);
  const withStatus = () => {
    const res = capture();
    res.statusCode = 200;
    res.status = (code: number) => { res.statusCode = code; return res; };
    return res;
  };

  it("lists the theme a site uploaded itself with no assignment, and never another site's", async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({ 'site-a': [{ theme_slug: 'aurora', state: 'active' }] }));
    const res = capture();

    await new ThemeController(managerWith(['aurora', 'mine', 'theirs'], { mine: 'site-a', theirs: 'site-b' })).list(boundTo('site-a'), res);

    expect(res.body.map((entry: any) => entry.slug).sort()).toEqual(['aurora', 'mine']);
  });

  it("refuses to activate another site's own theme — it used to put that site's private files on this storefront", async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({ 'site-a': [] }));
    const manager = managerWith(['theirs'], { theirs: 'site-b' });
    const res = withStatus();

    await new ThemeController(manager).activate(acting('site-a', 'theirs'), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('theme_not_available');
    expect(manager.activateTheme).not.toHaveBeenCalled();
  });

  it('refuses every action on a platform theme the site was never assigned', async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({ 'site-a': [] }));
    const manager = managerWith(['nocturne']);
    const controller = new ThemeController(manager);

    for (const action of ['activate', 'disable', 'reset', 'getConfig', 'saveConfig'] as const) {
      const res = withStatus();
      await (controller as any)[action](acting('site-a', 'nocturne'), res);
      expect(res.statusCode).toBe(404);
    }
    expect(manager.activateTheme).not.toHaveBeenCalled();
    expect(manager.saveThemeConfig).not.toHaveBeenCalled();
  });

  it("lets a site act on its own theme and on one assigned to it, and leaves PLATFORM scope as it was", async () => {
    multiTenant();
    TenantThemeAccess.configure(rowsByTenant({ 'site-a': [{ theme_slug: 'aurora', state: 'inactive' }] }));
    const manager = managerWith(['aurora', 'mine', 'nocturne'], { mine: 'site-a' });
    const controller = new ThemeController(manager);

    await controller.activate(acting('site-a', 'mine'), withStatus());
    await controller.activate(acting('site-a', 'aurora'), withStatus());
    await controller.activate(acting(null, 'nocturne'), withStatus());

    expect(manager.activateTheme.mock.calls.map((call: unknown[]) => call[0])).toEqual(['mine', 'aurora', 'nocturne']);
  });
});
