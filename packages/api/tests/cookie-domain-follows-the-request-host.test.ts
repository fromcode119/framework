import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiUrlUtils } from '@api/utils/url';

/**
 * Which `Domain` a storefront cookie is set on. `COOKIE_DOMAIN` used to apply to EVERY host, so a site
 * answering on another domain (a host alias) got a CSRF cookie its browser refused, and every protected
 * request from that host failed "CSRF Validation failed … Header: missing". Without `COOKIE_DOMAIN` the
 * last two labels were taken, which is a public suffix for `shop.acme.co.uk` or `x.trycloudflare.com` —
 * also refused by the browser.
 */
describe('ApiUrlUtils.getCookieDomain', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses COOKIE_DOMAIN for a host under it', () => {
    vi.stubEnv('COOKIE_DOMAIN', '.framework.local');
    expect(ApiUrlUtils.getCookieDomain('vselenskiportal.framework.local')).toBe('.framework.local');
    expect(ApiUrlUtils.getCookieDomain('framework.local')).toBe('.framework.local');
  });

  it('ignores COOKIE_DOMAIN for a host outside it', () => {
    vi.stubEnv('COOKIE_DOMAIN', '.framework.local');
    expect(ApiUrlUtils.getCookieDomain('www.vselenskiportal88.com')).toBe('.vselenskiportal88.com');
  });

  it('never returns a public suffix', () => {
    vi.stubEnv('COOKIE_DOMAIN', '');
    expect(ApiUrlUtils.getCookieDomain('shop.acme.co.uk')).toBe('.acme.co.uk');
    expect(ApiUrlUtils.getCookieDomain('ultimate-helen-revenue-suspected.trycloudflare.com'))
      .toBe('.ultimate-helen-revenue-suspected.trycloudflare.com');
  });

  it('keeps localhost and IPs host-only', () => {
    expect(ApiUrlUtils.getCookieDomain('localhost')).toBeUndefined();
    expect(ApiUrlUtils.getCookieDomain('127.0.0.1')).toBeUndefined();
  });
});
