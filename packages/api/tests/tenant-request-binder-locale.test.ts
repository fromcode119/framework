import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntegrationTenantAccess, PluginTenantAccess, RequestContextUtils, SiteLocaleAccess, TenantThemeAccess } from '@fromcode119/core';
import { TenantRequestBinder } from '@api/server/tenant-request-binder';

/**
 * A visitor's request that names no locale speaks its SITE's language. Resolved before the tenant was
 * known, the request locale is the platform default, so a Bulgarian site's visitors got English for every
 * string the API translated.
 */
class BinderLocaleFixture {
  static async localeFor(surface: string, localeExplicit: boolean): Promise<{ context?: string; req: string }> {
    vi.spyOn(PluginTenantAccess, 'warm').mockResolvedValue(undefined as never);
    vi.spyOn(TenantThemeAccess, 'warm').mockResolvedValue(undefined as never);
    vi.spyOn(IntegrationTenantAccess, 'warm').mockResolvedValue(undefined as never);
    vi.spyOn(SiteLocaleAccess, 'warm').mockResolvedValue(undefined as never);
    vi.spyOn(SiteLocaleAccess, 'get').mockReturnValue('bg');
    const db = { withTenant: async <T>(_id: string, fn: () => Promise<T>) => fn() };
    const binder = new TenantRequestBinder(db, { error: () => undefined });
    const req: any = { localeExplicit }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = { on: (_event: string, done: () => void) => done() };
    let context: string | undefined;
    await binder.bind(req, res, 'en', { id: 'site-a' } as never, () => { context = RequestContextUtils.getLocale(); }, surface);
    return { context, req: req.locale };
  }
}

describe('TenantRequestBinder request locale', () => {
  afterEach(() => vi.restoreAllMocks());

  it("gives a storefront request that names no locale its site's default", async () => {
    expect(await BinderLocaleFixture.localeFor(TenantRequestBinder.STOREFRONT_SURFACE, false)).toEqual({ context: 'bg', req: 'bg' });
  });

  it('keeps a locale the request named', async () => {
    expect(await BinderLocaleFixture.localeFor(TenantRequestBinder.STOREFRONT_SURFACE, true)).toEqual({ context: 'en', req: 'en' });
  });

  it('leaves the admin console on the locale it resolved', async () => {
    expect(await BinderLocaleFixture.localeFor('admin', false)).toEqual({ context: 'en', req: 'en' });
  });
});
