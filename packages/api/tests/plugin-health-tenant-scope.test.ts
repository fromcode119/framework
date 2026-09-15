import { PluginTenantAccess, TenantMode } from '@fromcode119/core';
import { PluginController } from '@api/controllers/plugins/plugin-controller';

/**
 * A site sees the health of ITS OWN plugins.
 *
 * Health is a richer disclosure than the plugin list: it carries each plugin's slug, its state, why
 * it is held, the error it failed to load with, and the capabilities it asked for. Reported whole to
 * a request bound to one site, that is every other customer's registry — so it is filtered on the
 * same axis and by the same rule as the list, and the axis is "is a site bound", never "who asked".
 */

const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

const boundTo = (tenantId: string) => ({ query: {}, tenantId } as any);
const platformScope = () => ({ query: {} } as any);

function capture() {
  const res: any = { body: undefined };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

const rowsByTenant = (store: Record<string, Array<Record<string, unknown>>>) => ({
  find: vi.fn(async (_table: string, query: any) => store[String(query?.where?.tenant_id)] ?? []),
} as any);

const managerWith = (slugs: string[]) => ({
  getPlugins: () => slugs.map((slug) => ({
    manifest: { slug, capabilities: ['network'] },
    state: 'active',
    healthStatus: 'ok',
    heldReason: slug === 'gamma' ? 'capability change awaiting approval' : undefined,
    error: slug === 'beta' ? 'failed to load' : undefined,
    approvedCapabilities: [],
  })),
} as any);

/** Every slug the report mentions, wherever the builder puts them. */
const slugsIn = (report: unknown): string[] => {
  const found = new Set<string>();
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.slug === 'string') found.add(node.slug);
    for (const value of Object.values(node)) walk(value);
  };
  walk(report);
  return [...found].sort();
};

afterEach(() => { TenantMode.reset(); PluginTenantAccess.reset(); });

describe('plugin health inside a site', () => {
  it('reports only the plugins that site runs', async () => {
    multiTenant();
    PluginTenantAccess.configure(rowsByTenant({ 'site-a': [{ plugin_slug: 'alpha', state: 'active' }] }));
    await PluginTenantAccess.warm('site-a');
    const res = capture();

    await new PluginController(managerWith(['alpha', 'beta', 'gamma'])).health(boundTo('site-a'), res);

    expect(slugsIn(res.body)).toEqual(['alpha']);
  });

  it('does not leak another customer’s held reason or load error', async () => {
    multiTenant();
    PluginTenantAccess.configure(rowsByTenant({ 'site-a': [{ plugin_slug: 'alpha', state: 'active' }] }));
    await PluginTenantAccess.warm('site-a');
    const res = capture();

    await new PluginController(managerWith(['alpha', 'beta', 'gamma'])).health(boundTo('site-a'), res);
    const serialized = JSON.stringify(res.body);

    expect(serialized).not.toMatch(/failed to load/);
    expect(serialized).not.toMatch(/awaiting approval/);
  });

  it('reports the WHOLE registry in platform scope — that is the operator’s view', async () => {
    multiTenant();
    PluginTenantAccess.configure(rowsByTenant({}));
    const res = capture();

    await new PluginController(managerWith(['alpha', 'beta', 'gamma'])).health(platformScope(), res);

    expect(slugsIn(res.body)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('reports everything on a SINGLE-TENANT deployment, where there is no site to scope to', async () => {
    PluginTenantAccess.configure(rowsByTenant({}));
    const res = capture();

    await new PluginController(managerWith(['alpha', 'beta'])).health(boundTo('site-a'), res);

    expect(slugsIn(res.body)).toEqual(['alpha', 'beta']);
  });
});
