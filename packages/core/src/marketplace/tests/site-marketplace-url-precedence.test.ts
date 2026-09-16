import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteMarketplaceUrl } from '@core/marketplace/site-marketplace-url';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';

/**
 * ONE key answers the platform and every site.
 *
 * `_system_meta` is keyed `(key, tenant_id)` with NULLS NOT DISTINCT, so a site's row and the
 * platform's coexist under the same name, and the table's policy already publishes the platform's row
 * to every tenant for the keys on its allowlist. Inheritance was therefore already in the schema; a
 * second key existed only to name the site's copy.
 *
 * What is NOT in the schema is precedence. Both rows can be visible at once, and `findOne` returns
 * whichever the planner reaches first — so the choice has to be made here, and these pin it.
 */

const PLATFORM = { tenantId: null, value: 'https://platform.example' };
const SITE = { tenantId: 'my-site', value: 'https://mysite.example' };

const wire = (rows: Array<{ tenantId: string | null; value: string }>) =>
  SiteMarketplaceUrl.registerAccessor(vi.fn(async () => rows));

const inSite = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
  RequestContextUtils.storage.run({ tenantId } as any, fn);

afterEach(() => SiteMarketplaceUrl.reset());

describe('marketplace URL precedence', () => {
  it('gives a site its OWN row when it has set one', async () => {
    wire([PLATFORM, SITE]);
    expect(await inSite('my-site', () => SiteMarketplaceUrl.current())).toBe('https://mysite.example');
  });

  it('gives a site the PLATFORM row when it has not — the inheritance itself', async () => {
    wire([PLATFORM]);
    expect(await inSite('my-site', () => SiteMarketplaceUrl.current())).toBe('https://platform.example');
  });

  it('never gives a site ANOTHER site’s row', async () => {
    // The policy would not return it, but precedence must not reach for it either: a stray row must
    // fall through to the platform's value rather than be treated as "a site row, close enough".
    wire([PLATFORM, { tenantId: 'other-site', value: 'https://other.example' }]);
    expect(await inSite('my-site', () => SiteMarketplaceUrl.current())).toBe('https://platform.example');
  });

  it('gives the PLATFORM its own row, never a site’s', async () => {
    wire([PLATFORM, SITE]);
    expect(await SiteMarketplaceUrl.current()).toBe('https://platform.example');
  });

  it('treats a blank site row as “not set” and inherits', async () => {
    wire([PLATFORM, { tenantId: 'my-site', value: '' }]);
    expect(await inSite('my-site', () => SiteMarketplaceUrl.current())).toBe('https://platform.example');
  });

  it('falls back to the environment only when the store holds nothing', async () => {
    wire([]);
    expect(await inSite('my-site', () => SiteMarketplaceUrl.current('https://env.example'))).toBe('https://env.example');
  });

  it('prefers a stored value over the environment', async () => {
    wire([PLATFORM]);
    expect(await inSite('my-site', () => SiteMarketplaceUrl.current('https://env.example'))).toBe('https://platform.example');
  });

  it('answers nothing, not a guess, when the read throws', async () => {
    SiteMarketplaceUrl.registerAccessor(vi.fn(async () => { throw new Error('connection reset'); }));
    expect(await inSite('my-site', () => SiteMarketplaceUrl.current())).toBe('');
  });
});

describe('the key’s declared scope', () => {
  it('keeps marketplace_url on the row-level policy’s platform allowlist', () => {
    // If it left this list the platform's row would stop being visible inside a tenant, and every
    // site that has not set its own would silently lose the operator's catalogue.
    expect(TenantBespokePolicies.platformKeys()).toContain(SystemConstants.META_KEY.MARKETPLACE_URL);
  });

  it('marks it inheritable, so a site may hold its own row', () => {
    expect(SystemSettingRegistry.inheritedKeys()).toContain(SystemConstants.META_KEY.MARKETPLACE_URL);
  });

  it('keeps inherited keys a SUBSET of platform keys', () => {
    const platform = new Set(SystemSettingRegistry.platformKeys());
    for (const key of SystemSettingRegistry.inheritedKeys()) expect(platform.has(key)).toBe(true);
  });

  it('does not treat it as site-scoped, so platform code may still read it', () => {
    // `PlatformSettingsService.getSetting` throws for a site-scoped key; the update service and the
    // appearance installer both read this one at boot.
    expect(SystemSettingRegistry.isDeclaredSiteScoped(SystemConstants.META_KEY.MARKETPLACE_URL)).toBe(false);
  });
});
