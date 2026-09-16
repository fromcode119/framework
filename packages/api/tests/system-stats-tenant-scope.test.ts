import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemAdminController } from '@api/controllers/system/system-admin-controller';
import { AdminScope, TenantMode } from '@fromcode119/core';

/**
 * Two dashboard endpoints that answered with the whole container.
 *
 * Both sit behind `system:view` — a permission a SITE's own administrator holds, not a platform one.
 * So this is not "a platform admin sees too much"; it is one customer's administrator being handed
 * facts about every other customer, with no elevated privilege anywhere in the path.
 *
 *   /admin/stats/installation — how many SITES exist on this platform, and how many accounts in
 *                               total. A site count IS the customer count.
 *   /admin/stats/security     — every plugin slug on the box, its isolation state, the running
 *                               plugin processes and the host's memory.
 *
 * Same permission and same shape as the sites-roster leak fixed earlier; these two endpoints were
 * missed by that pass.
 */
const PLUGINS = [
  { manifest: { slug: 'cms', sandbox: true }, state: 'active', isSandboxed: true },
  { manifest: { slug: 'seo', sandbox: false }, state: 'active', isSandboxed: false },
  { manifest: { slug: 'mlm', sandbox: true }, state: 'active', isSandboxed: true },
];

const SUMMARY = {
  sandbox: { processes: [{ pid: 1, slug: 'mlm' }] },
  hostMemory: { rssBytes: 123 },
  monitor: { denials: 0 },
  pluginIsolation: {
    totalPlugins: 3,
    activePlugins: 3,
    unsandboxedActivePluginSlugs: ['seo'],
    sandboxPolicyRuntimeMismatchSlugs: [],
  },
  integrityEnforced: true,
  signatureEnforced: false,
};

// Both endpoints answer for the whole container on a single-site deployment, which is correct there
// — there is no second customer to withhold anything from. The scoping only exists in tenant mode.
beforeEach(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
afterEach(() => TenantMode.reset());

const respond = () => {
  const out: any = {};
  return { res: { json: (body: any) => { out.body = body; return out; }, status: () => ({ json: (b: any) => { out.body = b; return out; } }) } as any, out };
};

const controller = (opts: { rows?: any[] } = {}) => {
  const runtime = {
    db: {
      count: vi.fn(async () => 9),
      find: vi.fn(async () => opts.rows ?? [{}, {}]),
      // The platform path reads settings through `readMeta`; without it the controller throws and the
      // test would pass for the wrong reason — an error body has no `counts.sites` either.
      findOne: vi.fn(async () => ({ value: '' })),
    },
    themeManager: { getThemes: () => [{}, {}, {}], getActiveThemeManifest: () => ({ name: 'x' }) },
    manager: { getSecuritySummary: vi.fn(async () => SUMMARY), getPlugins: () => PLUGINS },
  };
  return new SystemAdminController(runtime as never);
};

describe('installation stats', () => {
  it('does not tell a site how many SITES or accounts the platform has', async () => {
    const { res, out } = respond();
    await controller().getInstallation({ tenantId: 'initech' } as never, res);

    expect(out.body.counts).not.toHaveProperty('sites');
    expect(out.body.counts.users).toBe(2); // this site's memberships, not every account
    expect(out.body).not.toHaveProperty('mode'); // "multi-site" describes the container
    expect(out.body.scope).toBe(AdminScope.SITE);
  });

  it('still describes the whole installation in the platform scope', async () => {
    const { res, out } = respond();
    await controller().getInstallation({} as never, res);

    expect(out.body.counts.sites).toBe(9);
    expect(out.body.mode).toBe('multi-site');
  });

  it('stamps the scope on the platform branch too, so the dashboard never has to guess', async () => {
    const { res, out } = respond();
    await controller().getInstallation({} as never, res);

    // The dashboard heads its activity card from this. Absent, it can only say "Recent" — and a card
    // headed "Platform Activity" inside a site is the defect this whole pass is about.
    // The member, not the string: `res.json` here captures the body before serialisation. That it
    // goes over the wire as "platform" is asserted in admin-scope.enum.test.ts.
    expect(out.body.scope).toBe(AdminScope.PLATFORM);
  });
});

describe('security stats', () => {
  it('names only the plugins this site runs', async () => {
    const { res, out } = respond();
    await controller().getSecurityStats({ tenantId: 'initech' } as never, res);

    // `enabledSlugsFor` answers empty for an unknown site, which is the fail-closed direction.
    expect(out.body.pluginIsolation.totalPlugins).toBeLessThan(SUMMARY.pluginIsolation.totalPlugins);
    expect(out.body.scope).toBe(AdminScope.SITE);
  });

  it('withholds the container facts a site cannot have a version of', async () => {
    const { res, out } = respond();
    await controller().getSecurityStats({ tenantId: 'initech' } as never, res);

    expect(out.body).not.toHaveProperty('sandbox');      // every plugin PROCESS on the box
    expect(out.body).not.toHaveProperty('hostMemory');   // the shared container's memory
  });

  it('is unchanged in the platform scope', async () => {
    const { res, out } = respond();
    await controller().getSecurityStats({} as never, res);

    expect(out.body).toEqual(SUMMARY);
  });
});
