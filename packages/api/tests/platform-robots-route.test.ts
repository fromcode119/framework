import { describe, expect, it, vi } from 'vitest';
import { TenantExemptRouteUtils } from '@api/utils/tenant-exempt-route-utils';
import { PlatformRobotsRouter } from '@api/routes/platform-robots-router';
import { PlatformSettingsService, RequestContextUtils } from '@fromcode119/core';

/**
 * The exemption skips tenancy entirely, so anything it matches runs with NO tenant bound. The
 * platform's own robots.txt has to be the ONLY thing it matches — a site's robots.txt is served by a
 * plugin under `api/v1/plugins/<slug>/...`, and exempting that would hand a tenant's route an
 * untenanted request, which is exactly what the old `/health` suffix match did.
 */
describe('TenantExemptRouteUtils.isPlatformRobotsRoute', () => {
  const isRobots = (path: string) => TenantExemptRouteUtils.isPlatformRobotsRoute({ path });

  it('matches the platform robots.txt at the root, with or without a trailing slash', () => {
    expect(isRobots('/robots.txt')).toBe(true);
    expect(isRobots('/robots.txt/')).toBe(true);
  });

  it('does NOT match a tenant or versioned path that ends in robots.txt', () => {
    expect(isRobots('/api/v1/robots.txt')).toBe(false);
    expect(isRobots('/api/v1/plugins/seo/robots.txt')).toBe(false);
    expect(isRobots('/api/v1/pages/robots.txt')).toBe(false);
    expect(isRobots('/sitemap.xml')).toBe(false);
  });
});

/**
 * The body is decided by the operator's indexing setting, and the ABSENT/unreadable case must read
 * as "do not index" — a platform briefly refusing a crawler costs nothing, one briefly inviting it
 * into an index is not undone by a later correction.
 */
describe('PlatformRobotsRouter', () => {
  const render = async (flag: boolean): Promise<{ body: string; headers: Record<string, string> }> => {
    vi.spyOn(PlatformSettingsService, 'readFlag').mockResolvedValue(flag);
    const headers: Record<string, string> = {};
    let body = '';
    const res: any = {
      setHeader: (name: string, value: string) => { headers[name] = value; },
      status: () => res,
      type: () => res,
      send: (payload: string) => { body = payload; },
    };
    await (PlatformRobotsRouter as any).answer(res);
    return { body, headers };
  };

  it('refuses crawlers when the setting is off', async () => {
    const { body } = await render(false);
    expect(body).toBe('User-agent: *\nDisallow: /\n');
  });

  it('allows them only when the operator turned it on', async () => {
    const { body } = await render(true);
    expect(body).toBe('User-agent: *\nAllow: /\n');
  });

  it('never lets the answer be cached past the setting that produced it', async () => {
    const { headers } = await render(false);
    expect(headers['Cache-Control']).toBe('no-store, must-revalidate');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});

/**
 * `robots.txt` only reaches a crawler that ASKS first. A URL linked from elsewhere is fetched without
 * it, and `Disallow` then makes matters worse — the crawler cannot read the page, so it indexes the
 * bare address. The header is the half that covers that, and the api emitted none.
 *
 * It must stay off a SITE's responses: a tenant's indexability is its own (`_system_tenants.visibility`),
 * and stamping the platform's refusal on tenant traffic would let one switch de-index every customer.
 */
describe('PlatformRobotsHeaderMiddleware', () => {
  const run = async (opts: { flag: boolean; tenantId: string | null }): Promise<Record<string, string>> => {
    vi.spyOn(PlatformSettingsService, 'readFlag').mockResolvedValue(opts.flag);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(opts.tenantId as any);

    const { PlatformRobotsHeaderMiddleware } = await import('@api/middlewares/platform-robots-header-middleware');
    const subject = new PlatformRobotsHeaderMiddleware();
    const pass = async (): Promise<Record<string, string>> => {
      // A FRESH response each time. Express gives every request its own; sharing one here let the
      // cold-start refusal linger and made the "indexing on" case look broken.
      const headers: Record<string, string> = {};
      const res: any = { setHeader: (name: string, value: string) => { headers[name] = value; } };
      await new Promise<void>((resolve) => subject.middleware()({} as any, res, resolve as any));
      return headers;
    };

    // The first request primes the cache and refuses, fail-closed; the second reads the settled answer.
    await pass();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return pass();
  };

  it('refuses on the very first request, before any answer has arrived', async () => {
    vi.spyOn(PlatformSettingsService, 'readFlag').mockResolvedValue(true);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(null as any);
    const { PlatformRobotsHeaderMiddleware } = await import('@api/middlewares/platform-robots-header-middleware');
    const headers: Record<string, string> = {};
    const res: any = { setHeader: (name: string, value: string) => { headers[name] = value; } };
    await new Promise<void>((resolve) => new PlatformRobotsHeaderMiddleware().middleware()({} as any, res, resolve as any));
    expect(headers['X-Robots-Tag']).toBe('noindex, nofollow, noarchive');
  });

  it('refuses indexing on a platform host when the setting is off', async () => {
    expect(await run({ flag: false, tenantId: null })).toMatchObject({ 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
  });

  it('says nothing on a platform host once the operator turns indexing on', async () => {
    expect((await run({ flag: true, tenantId: null }))['X-Robots-Tag']).toBeUndefined();
  });

  it('never stamps a SITE response — a tenant owns its own indexability', async () => {
    expect((await run({ flag: false, tenantId: 'acme' }))['X-Robots-Tag']).toBeUndefined();
  });

  it('refuses again once the cache goes stale, instead of repeating its last answer', async () => {
    vi.spyOn(PlatformSettingsService, 'readFlag').mockResolvedValue(true);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(null as any);
    const { PlatformRobotsHeaderMiddleware } = await import('@api/middlewares/platform-robots-header-middleware');
    const subject = new PlatformRobotsHeaderMiddleware();
    const pass = async (): Promise<string | undefined> => {
      const headers: Record<string, string> = {};
      const res: any = { setHeader: (n: string, v: string) => { headers[n] = v; } };
      await new Promise<void>((resolve) => subject.middleware()({} as any, res, resolve as any));
      return headers['X-Robots-Tag'];
    };

    await pass();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await pass()).toBeUndefined();

    // Turning indexing OFF must not wait out the TTL: a cache older than the TTL refuses, so the
    // window in which responses still carried no header — the one direction that cannot be taken
    // back — does not exist.
    const stale = Date.now() + 61_000;
    vi.spyOn(Date, 'now').mockReturnValue(stale);
    expect(await pass()).toBe('noindex, nofollow, noarchive');
    vi.mocked(Date.now).mockRestore();
  });
});
