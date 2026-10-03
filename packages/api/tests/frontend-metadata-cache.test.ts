import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseCache, PluginState, RequestContextUtils, SiteContentRevision, TenantResolverService } from '@fromcode119/core';
import { SiteVisibilityGate } from '@api/server/site-visibility-gate';
import { FrontendMetadataCache } from '@api/services/system/frontend-metadata-cache';
import { SystemController } from '@api/controllers/system/system-controller';

/**
 * `/system/frontend` is asked for on every storefront render. Its site parts — admin metadata, public
 * settings, plugins' public settings — are now kept per site and content revision, and requests that
 * arrive together share one computation. What must never happen: one site served another's parts, a
 * change not showing on the next request, or anything decided per caller being served to the next one.
 */

const parts = (label: string) => ({
  adminMetadata: { menu: [], plugins: [], label },
  publicSettings: { site: label },
  pluginPublicSettings: {},
  ssrGenerationCap: 1,
  ssrRenderMemoryMb: 256,
  ssrRenderTimeoutMs: 10_000,
});
const inSite = <T>(tenantId: string | undefined, work: () => T): T => RequestContextUtils.storage.run({ tenantId } as any, work);

beforeEach(() => ApiResponseCache.useMaxAge(() => 60));
afterEach(() => vi.useRealTimers());

describe('FrontendMetadataCache', () => {
  it('twenty requests arriving together compute the site parts once', async () => {
    const cache = new FrontendMetadataCache();
    let release!: () => void;
    const compute = vi.fn(() => new Promise<any>((resolve) => { release = () => resolve(parts('a')); }));
    const answers = inSite('site-a', () => Array.from({ length: 20 }, () => cache.get('sig', compute)));
    release();
    const resolved = await Promise.all(answers);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(new Set(resolved).size).toBe(1);
  });

  it('never serves one site another site\'s parts', async () => {
    const cache = new FrontendMetadataCache();
    const a = await inSite('site-a', () => cache.get('sig', async () => parts('a')));
    const b = await inSite('site-b', () => cache.get('sig', async () => parts('b')));
    expect(a.publicSettings).toEqual({ site: 'a' });
    expect(b.publicSettings).toEqual({ site: 'b' });
    expect((await inSite('site-a', () => cache.get('sig', async () => parts('x')))).publicSettings).toEqual({ site: 'a' });
  });

  it('recomputes after a write moves the site\'s content revision — and only that site\'s', async () => {
    const cache = new FrontendMetadataCache();
    await inSite('site-a', () => cache.get('sig', async () => parts('a1')));
    await inSite('site-b', () => cache.get('sig', async () => parts('b1')));
    SiteContentRevision.bump('site-a');
    expect((await inSite('site-a', () => cache.get('sig', async () => parts('a2')))).publicSettings).toEqual({ site: 'a2' });
    expect((await inSite('site-b', () => cache.get('sig', async () => parts('b2')))).publicSettings).toEqual({ site: 'b1' });
  });

  it('recomputes after a platform-level change (every site)', async () => {
    const cache = new FrontendMetadataCache();
    await inSite('site-a', () => cache.get('sig', async () => parts('a1')));
    SiteContentRevision.bump(null);
    expect((await inSite('site-a', () => cache.get('sig', async () => parts('a2')))).publicSettings).toEqual({ site: 'a2' });
  });

  it('recomputes when the site\'s plugin set or theme changes, with no write in between', async () => {
    const cache = new FrontendMetadataCache();
    await inSite('site-a', () => cache.get('["theme@1",["cms@1"]]', async () => parts('before')));
    const after = await inSite('site-a', () => cache.get('["theme@1",["cms@1","seo@1"]]', async () => parts('after')));
    expect(after.publicSettings).toEqual({ site: 'after' });
  });

  it('keeps nothing longer than the operator\'s maximum age', async () => {
    vi.useFakeTimers();
    const cache = new FrontendMetadataCache();
    await inSite('site-a', () => cache.get('sig', async () => parts('old')));
    vi.advanceTimersByTime(61_000);
    expect((await inSite('site-a', () => cache.get('sig', async () => parts('new')))).publicSettings).toEqual({ site: 'new' });
  });

  it('keeps nothing when the operator turned the API response cache off', async () => {
    ApiResponseCache.useMaxAge(() => 0);
    const cache = new FrontendMetadataCache();
    const compute = vi.fn(async () => parts('a'));
    await inSite('site-a', () => cache.get('sig', compute));
    await inSite('site-a', () => cache.get('sig', compute));
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('forgets a failed computation, so the next request tries again', async () => {
    const cache = new FrontendMetadataCache();
    await expect(inSite('site-a', () => cache.get('sig', async () => { throw new Error('db down'); }))).rejects.toThrow('db down');
    expect((await inSite('site-a', () => cache.get('sig', async () => parts('ok')))).publicSettings).toEqual({ site: 'ok' });
  });
});

describe('SystemController.getFrontendMetadata with the site parts kept', () => {
  afterEach(() => vi.restoreAllMocks());
  const build = (_closedSite: boolean) => {
    const manager: any = {
      hooks: { on: vi.fn() },
      getAdminMetadata: vi.fn().mockResolvedValue({ menu: [], plugins: [] }),
      getRuntimeModules: vi.fn().mockReturnValue({}),
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { namespace: 'org.fromcode', slug: 'demo', version: '1.0.0', name: 'Demo' } }]),
      getSortedPlugins: vi.fn().mockImplementation((plugins: any[]) => plugins),
      getHeadInjections: vi.fn().mockReturnValue([]),
      getPublicFrontendPluginSettings: vi.fn().mockResolvedValue({}),
      db: { findOne: vi.fn().mockResolvedValue(null), find: vi.fn().mockResolvedValue([]), withPlatformAdmin: (work: () => unknown) => work() },
    };
    const controller = new SystemController(manager, { getFrontendMetadata: vi.fn().mockResolvedValue({ activeTheme: null }), getThemes: vi.fn().mockReturnValue([]) } as any, {} as any, {} as any);
    const metadataController = (controller as any).metadata ?? controller;
    return { manager, controller, metadataController };
  };
  const call = async (controller: any, req: any = {}) => {
    const res: any = { json: vi.fn(), set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() };
    await controller.getFrontendMetadata(req, res);
    return res.json.mock.calls[0][0];
  };

  it('a burst of storefront renders builds the admin metadata and settings once, and every one gets the full answer', async () => {
    const { manager, controller } = build(false);
    const answers = await Promise.all(Array.from({ length: 20 }, () => call(controller)));
    expect(manager.getAdminMetadata).toHaveBeenCalledTimes(1);
    expect(manager.getPublicFrontendPluginSettings).toHaveBeenCalledTimes(1);
    for (const answer of answers) {
      expect(answer.plugins.map((plugin: any) => plugin.slug)).toEqual(['demo']);
      expect(answer).toHaveProperty('publicSettings');
      expect(answer).toHaveProperty('ssrGenerationCap');
    }
  });

  it('a saved setting shows on the very next request', async () => {
    const { manager, controller } = build(false);
    await call(controller);
    SiteContentRevision.bump(null);
    await call(controller);
    expect(manager.getAdminMetadata).toHaveBeenCalledTimes(2);
  });

  it('carries nothing about the caller: two different signed-in people get the same site answer', async () => {
    const { controller } = build(false);
    const first = await RequestContextUtils.runAs({ id: 1, email: 'ann@example.com', roles: ['customer'] }, () => call(controller, { headers: { cookie: 'fc_token=ann' } }));
    const second = await RequestContextUtils.runAs({ id: 2, email: 'bob@example.com', roles: ['admin'] }, () => call(controller, { headers: { cookie: 'fc_token=bob' } }));
    expect(second).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(/ann@example\.com|bob@example\.com|fc_token/);
  });

  it('whether THIS caller may preview a closed site is decided per request, never served from the kept parts', async () => {
    const { manager, controller } = build(true);
    const closed = { id: 'site-a', slug: 'a', isReadable: false, isIndexable: false, visibility: { value: 'private' }, environment: { value: 'production', isProduction: true } };
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({ resolveById: async () => closed } as any);
    vi.spyOn(SiteVisibilityGate.prototype, 'canPreview').mockImplementation(async (_site: any, req: any) => req?.headers?.cookie === 'fc_site_preview=granted');
    const holder = await inSite('site-a', () => call(controller, { headers: { cookie: 'fc_site_preview=granted' } }));
    const stranger = await inSite('site-a', () => call(controller, { headers: {} }));
    const holderAgain = await inSite('site-a', () => call(controller, { headers: { cookie: 'fc_site_preview=granted' } }));
    expect([holder.site.preview, stranger.site.preview, holderAgain.site.preview]).toEqual([true, false, true]);
    expect(manager.getAdminMetadata).toHaveBeenCalledTimes(1);
  });
});
