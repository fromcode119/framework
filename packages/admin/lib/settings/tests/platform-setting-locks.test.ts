import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * A plain stub, not a `vi.fn()`. Vitest v4 fails a test whose spy RECORDED a throw, even when the
 * code under test catches it — and catching it is exactly what the last case here asserts.
 */
let get: (...args: unknown[]) => unknown = () => null;

vi.mock('@/lib/api', () => ({ AdminApi: { get: (...a: unknown[]) => get(...a) } }));

const { PlatformSettingLocks } = await import('@/lib/settings/platform-setting-locks');

const PLATFORM_KEY = 'marketplace_url';
const SITE_KEY = 'timezone';

/**
 * Scope decides which settings the screen SHOWS, and separately which it may SAVE.
 *
 * Settings → General saved nothing in the `PLATFORM / No site` scope: the page sent all fifteen of
 * its keys, eight of them per-site, and the API refuses such a PUT whole — so the platform keys the
 * operator had just edited went down with it. Showing only the current scope's settings removes the
 * class of bug, but only if `shown` and `writable` stay distinct: a platform admin inside a site may
 * WRITE a platform key while its control lives in the platform scope, and sending a hidden field's
 * form value would overwrite whatever someone else changed since the page loaded.
 */
describe('PlatformSettingLocks', () => {
  beforeEach(() => { get = () => null; });

  const load = (body: Record<string, unknown>) => {
    get = () => Promise.resolve(body);
    return PlatformSettingLocks.load();
  };

  const platformScope = () => load({ keys: [PLATFORM_KEY], editable: true, tenantMode: true, siteSelected: false });
  const siteScope = () => load({ keys: [PLATFORM_KEY], editable: true, tenantMode: true, siteSelected: true });
  const siteAdmin = () => load({ keys: [PLATFORM_KEY], editable: false, tenantMode: true, siteSelected: true });
  const singleTenant = () => load({ keys: [PLATFORM_KEY], editable: true, tenantMode: false, siteSelected: false });

  it('platform scope shows the platform settings and hides the per-site ones', async () => {
    const locks = await platformScope();

    expect(locks.shown(PLATFORM_KEY)).toBe(true);
    expect(locks.shown(SITE_KEY)).toBe(false);
    expect(locks.writable(PLATFORM_KEY)).toBe(true);
    expect(locks.isSiteScope()).toBe(false);
  });

  it('a site shows its own settings and hides the platform ones', async () => {
    const locks = await siteScope();

    expect(locks.shown(SITE_KEY)).toBe(true);
    expect(locks.shown(PLATFORM_KEY)).toBe(false);
    expect(locks.isSiteScope()).toBe(true);
  });

  it('keeps a hidden platform key WRITABLE for a platform admin — shown and writable are not the same test', async () => {
    const locks = await siteScope();

    expect(locks.shown(PLATFORM_KEY)).toBe(false);
    expect(locks.writable(PLATFORM_KEY)).toBe(true);
  });

  it('a site admin may neither see nor save a platform key', async () => {
    const locks = await siteAdmin();

    expect(locks.shown(PLATFORM_KEY)).toBe(false);
    expect(locks.writable(PLATFORM_KEY)).toBe(false);
    expect(locks.shown(SITE_KEY)).toBe(true);
    expect(locks.writable(SITE_KEY)).toBe(true);
  });

  it('a single-tenant deployment shows everything, undivided, and hides nothing', async () => {
    const locks = await singleTenant();

    expect(locks.shown(PLATFORM_KEY)).toBe(true);
    expect(locks.shown(SITE_KEY)).toBe(true);
    expect(locks.writable(PLATFORM_KEY)).toBe(true);
    expect(locks.hiddenScopeNotice(true)).toBe('');
    expect(locks.isSiteScope()).toBe(false);
  });

  it('names where the hidden half lives, and who may change it', async () => {
    expect((await platformScope()).hiddenScopeNotice(true)).toContain('inside each site');
    expect((await siteScope()).hiddenScopeNotice(true)).toContain('Platform scope');
    expect((await siteAdmin()).hiddenScopeNotice(false)).toContain('platform administrator');
  });

  it('shows everything and locks nothing when the request fails — an unanswered form is not a hidden one', async () => {
    get = () => { throw new Error('offline'); };
    const locks = await PlatformSettingLocks.load();

    expect(locks.shown(PLATFORM_KEY)).toBe(true);
    expect(locks.shown(SITE_KEY)).toBe(true);
    expect(locks.writable(PLATFORM_KEY)).toBe(true);
  });

  it('treats an older server that omits siteSelected as having a site', async () => {
    const locks = await load({ keys: [PLATFORM_KEY], editable: true, tenantMode: true });

    expect(locks.shown(SITE_KEY)).toBe(true);
    expect(locks.shown(PLATFORM_KEY)).toBe(false);
  });
});
