import { describe, expect, it, vi } from 'vitest';
import { TenantExemptRouteUtils } from '@api/utils/tenant-exempt-route-utils';
import { PlatformRobotsRouter } from '@api/routes/platform-robots-router';
import { PlatformSettingsService } from '@fromcode119/core';

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
