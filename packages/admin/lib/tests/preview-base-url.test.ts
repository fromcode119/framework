import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminUrlUtils } from '@/lib/url-utils';

/**
 * Where a record's Preview link opens.
 *
 * The console serves every site from one host, and a site-scoped console receives the PLATFORM's
 * `frontend_url` / `site_url` wherever the site has none of its own. The link used to be built from
 * those, then from a guess at the console's hostname — so on production every Preview opened the page
 * on the console ("Collection Not Found"), and locally on the platform's storefront rather than the
 * site's. The bound site's own storefront now comes first, as it already does for every emailed link.
 */
const ENV_KEYS = ['FRONTEND_URL', 'NEXT_PUBLIC_SITE_URL', 'PUBLIC_APP_URL', 'APP_URL'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) { saved[key] = process.env[key]; delete process.env[key]; }
});

afterEach(() => {
  for (const key of ENV_KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
});

describe('AdminUrlUtils.resolvePreviewBaseUrl', () => {
  it('opens on the bound site’s storefront when nothing is configured', () => {
    expect(AdminUrlUtils.resolvePreviewBaseUrl({ frontend_url: '', site_url: '' }, 'https://shop.example.com'))
      .toBe('https://shop.example.com');
  });

  it('puts the site’s storefront before the platform addresses a site scope inherits', () => {
    const inherited = { frontend_url: 'http://frontend.platform.example', site_url: 'http://frontend.platform.example' };
    expect(AdminUrlUtils.resolvePreviewBaseUrl(inherited, 'http://shop.platform.example'))
      .toBe('http://shop.platform.example');
  });

  it('puts the site’s storefront before the environment', () => {
    process.env.FRONTEND_URL = 'https://platform.example.com';
    expect(AdminUrlUtils.resolvePreviewBaseUrl({}, 'https://shop.example.com/')).toBe('https://shop.example.com');
  });

  it('keeps the previous resolution when no site is bound', () => {
    expect(AdminUrlUtils.resolvePreviewBaseUrl({ frontend_url: 'https://front.example' }, '')).toBe('https://front.example');
    process.env.FRONTEND_URL = 'https://platform.example.com';
    expect(AdminUrlUtils.resolvePreviewBaseUrl({}, '')).toBe('https://platform.example.com');
  });
});
