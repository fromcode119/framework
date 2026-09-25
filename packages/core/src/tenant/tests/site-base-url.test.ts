import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * The absolute address a link in an EMAIL should point at.
 *
 * Every such link was built from the deployment's configured URL — the PLATFORM's host, which carries
 * no tenant. The recipient clicked, landed where tenancy could not resolve them, and the link 404'd;
 * one of them was a legally required unsubscribe.
 *
 * The scheme is the interesting part. A tenant record holds hosts and no scheme, and inventing one
 * breaks a real deployment either way — local serves http, production https — so it is READ from the
 * address this installation already declares for the same app. Everything that cannot be answered
 * falls back to that platform URL, because a relative link in an email is worse than a link to the
 * platform.
 */

const ENV = { FRONTEND_URL: process.env.FRONTEND_URL, API_URL: process.env.API_URL, ADMIN_URL: process.env.ADMIN_URL };

const withUrls = (frontend: string, api: string) => {
  if (frontend) process.env.FRONTEND_URL = frontend; else delete process.env.FRONTEND_URL;
  if (api) process.env.API_URL = api; else delete process.env.API_URL;
};

const tenant = (primaryHost: string, aliases: string[] = []) => ({
  id: 'my-site',
  primaryHost,
  apiHosts: () => [primaryHost, ...aliases].filter((h) => h.startsWith('api.')),
});

const wire = (record: any) => {
  SiteBaseUrl.registerDatabase({} as never);
  vi.spyOn(TenantResolverService, 'shared').mockReturnValue({ resolveById: async () => record } as never);
};

const inSite = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
  RequestContextUtils.storage.run({ tenantId } as any, fn);

const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

afterEach(() => {
  SiteBaseUrl.reset();
  TenantMode.reset();
  vi.restoreAllMocks();
  withUrls(ENV.FRONTEND_URL ?? '', ENV.API_URL ?? '');
  if (ENV.ADMIN_URL) process.env.ADMIN_URL = ENV.ADMIN_URL; else delete process.env.ADMIN_URL;
});

describe('a site’s own base URL', () => {
  it('answers on the SITE’s host, not the platform’s', async () => {
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(tenant('shop.customer.example'));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('https://shop.customer.example');
  });

  it('takes the SCHEME this deployment declares, rather than assuming one', async () => {
    // Local development serves http. Assuming https here would produce a link nothing can open.
    multiTenant();
    withUrls('http://frontend.framework.local', 'http://api.framework.local');
    wire(tenant('shop.framework.local'));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('http://shop.framework.local');
  });

  it('uses the site’s api. alias for an API link, which is a different host', async () => {
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(tenant('shop.customer.example', ['api.customer.example']));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.API_APP)))
      .toBe('https://api.customer.example');
  });

  it('falls back to the site’s own host when it has no api. alias', async () => {
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(tenant('shop.customer.example'));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.API_APP)))
      .toBe('https://shop.customer.example');
  });

  it('answers with the PLATFORM’s URL when no site is bound', async () => {
    // A boot, a timer, a background job. There is no site to be "the site".
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(tenant('shop.customer.example'));

    expect(await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)).toBe('https://platform.example');
  });

  it('leaves a single-site deployment alone', async () => {
    withUrls('https://only.example', 'https://api.only.example');
    wire(tenant('shop.customer.example'));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('https://only.example');
  });

  it('falls back when the site cannot be resolved', async () => {
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(null);

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('https://platform.example');
  });

  it('falls back when the site has no host recorded', async () => {
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(tenant(''));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('https://platform.example');
  });

  it('takes the scheme from another declared app when the frontend has no URL of its own', async () => {
    // A multi-site platform configures its console and api but no single storefront address.
    multiTenant();
    withUrls('', '');
    process.env.ADMIN_URL = 'https://console.platform.example';
    wire(tenant('fromcode.example'));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('https://fromcode.example');
  });

  it('invents NOTHING when the deployment declares no URL to take a scheme from', async () => {
    // The whole answer would be a guess: the host is known, the scheme is not.
    multiTenant();
    withUrls('', '');
    delete process.env.ADMIN_URL;
    wire(tenant('shop.customer.example'));

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP))).toBe('');
  });

  it('falls back rather than throwing when the lookup fails', async () => {
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    SiteBaseUrl.registerDatabase({} as never);
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({
      resolveById: async () => { throw new Error('connection reset'); },
    } as never);

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('https://platform.example');
  });

  it('answers with the platform’s URL before the database is wired', async () => {
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');

    expect(await inSite('my-site', () => SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)))
      .toBe('https://platform.example');
  });
});

describe('a named site’s base URL, for display', () => {
  it('answers on that site’s host without needing a request context', async () => {
    multiTenant();
    withUrls('http://frontend.framework.local', 'http://api.framework.local');
    wire(tenant('shop.framework.local'));

    expect(await SiteBaseUrl.forSite('my-site', ApplicationUrlUtils.FRONTEND_APP)).toBe('http://shop.framework.local');
  });

  it('answers NOTHING, not the platform’s URL, when the site has no host', async () => {
    // A screen that says "this site is served at …" must not print the platform's host.
    multiTenant();
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(tenant(''));

    expect(await SiteBaseUrl.forSite('my-site', ApplicationUrlUtils.FRONTEND_APP)).toBe('');
  });

  it('answers nothing on a single-site deployment', async () => {
    withUrls('https://platform.example', 'https://api.platform.example');
    wire(tenant('shop.customer.example'));

    expect(await SiteBaseUrl.forSite('my-site', ApplicationUrlUtils.FRONTEND_APP)).toBe('');
  });
});
