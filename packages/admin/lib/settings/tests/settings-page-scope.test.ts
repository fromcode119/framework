import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SettingsScope } from '@/lib/settings/enums/settings-scope.enum';

/** A plain stub, not a `vi.fn()` — vitest v4 fails a test whose spy recorded a throw. */
let get: (...args: unknown[]) => unknown = () => null;
vi.mock('@/lib/api', () => ({ AdminApi: { get: (...a: unknown[]) => get(...a) } }));

const { PlatformSettingLocks } = await import('@/lib/settings/platform-setting-locks');
const { SettingsPageScope } = await import('@/lib/settings/settings-page-scope');

const PLATFORM_KEY = 'marketplace_url';
const SITE_KEYS = ['timezone', 'notification_email'];

/**
 * A page of purely per-site settings has NOTHING to show in the platform scope.
 *
 * Per-key filtering was enough for Settings → General, the one page mixing scopes. Everywhere else it
 * yields an empty form whose every control the API refuses — Security rendered twenty-three of them
 * and lost all twenty-three edits on save. `isEmpty` is what lets those pages say so instead.
 */
describe('SettingsPageScope', () => {
  beforeEach(() => { get = () => null; });

  const scopeOf = async (body: Record<string, unknown>, keys: readonly string[]) => {
    get = () => Promise.resolve(body);
    return new SettingsPageScope(await PlatformSettingLocks.load(), keys);
  };

  const platformScope = (keys: readonly string[]) =>
    scopeOf({ keys: [PLATFORM_KEY], editable: true, tenantMode: true, siteSelected: false }, keys);
  const siteScope = (keys: readonly string[]) =>
    scopeOf({ keys: [PLATFORM_KEY], editable: true, tenantMode: true, siteSelected: true }, keys);

  it('an all-site page is EMPTY in the platform scope, and says where its settings live', async () => {
    const scope = await platformScope(SITE_KEYS);

    expect(scope.isEmpty).toBe(true);
    expect(scope.visibleKeys).toEqual([]);
    expect(scope.hiddenBelongTo).toBe(SettingsScope.SITE);
    expect(scope.notice({ canManagePlatform: true })).toContain('inside each site');
  });

  it('the same page is whole inside a site', async () => {
    const scope = await siteScope(SITE_KEYS);

    expect(scope.isEmpty).toBe(false);
    expect(scope.visibleKeys).toEqual(SITE_KEYS);
    expect(scope.hiddenBelongTo).toBeNull();
    expect(scope.notice({ canManagePlatform: true })).toBe('');
  });

  it('a mixed page is never empty — it shows the half that belongs to the scope', async () => {
    const mixed = [...SITE_KEYS, PLATFORM_KEY];

    const platform = await platformScope(mixed);
    expect(platform.isEmpty).toBe(false);
    expect(platform.visibleKeys).toEqual([PLATFORM_KEY]);

    const site = await siteScope(mixed);
    expect(site.isEmpty).toBe(false);
    expect(site.visibleKeys).toEqual(SITE_KEYS);
    expect(site.hiddenBelongTo).toBe(SettingsScope.PLATFORM);
  });

  it('sends only what this scope owns', async () => {
    const scope = await platformScope([...SITE_KEYS, PLATFORM_KEY]);

    expect(scope.sendable({ timezone: 'UTC', notification_email: 'a@b.c', [PLATFORM_KEY]: 'x' }))
      .toEqual({ [PLATFORM_KEY]: 'x' });
  });

  it('tells a site admin WHO can change the platform half', async () => {
    get = () => Promise.resolve({ keys: [PLATFORM_KEY], editable: false, tenantMode: true, siteSelected: true });
    const scope = new SettingsPageScope(await PlatformSettingLocks.load(), [...SITE_KEYS, PLATFORM_KEY]);

    expect(scope.notice({ canManagePlatform: false })).toContain('platform administrator');
  });

  it('a single-tenant deployment shows everything and is never empty', async () => {
    const scope = await scopeOf({ keys: [PLATFORM_KEY], editable: true, tenantMode: false, siteSelected: false }, [...SITE_KEYS, PLATFORM_KEY]);

    expect(scope.isEmpty).toBe(false);
    expect(scope.visibleKeys).toEqual([...SITE_KEYS, PLATFORM_KEY]);
    expect(scope.notice({ canManagePlatform: true })).toBe('');
  });
});
