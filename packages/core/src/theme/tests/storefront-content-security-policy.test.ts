import { describe, expect, it } from 'vitest';
import { StorefrontContentSecurityPolicy } from '@core/theme/storefront-content-security-policy';

const theme = (extra: Record<string, unknown> = {}) => ({ slug: 'own', name: 'Own', version: '1.0.0', layouts: [], ...extra }) as any;

/**
 * A theme a site uploads is that site's whole front end, so its scripts cannot be fenced off from the
 * page. What its pages may load and where they may send data can be: these pin that fence.
 */
describe('the storefront policy for a site\'s own theme', () => {
  it('is absent for a platform theme', () => {
    expect(StorefrontContentSecurityPolicy.of(theme(), [{ ui: { storefrontHosts: ['js.payments.example'] } }])).toBeNull();
  });

  it('allows the site, the theme\'s declared hosts and its plugins\' storefront hosts, and nothing else', () => {
    const policy = StorefrontContentSecurityPolicy.of(
      theme({ ownerTenantId: 't1', network: { hosts: ['fonts.fonts.example', 'not a host'] } }),
      [{ ui: { storefrontHosts: ['js.payments.example', '*.payments.example'] } }, { ui: {} }],
      ['https://api.platform.example/api'],
    )!;

    const connect = policy.split('; ').find((directive) => directive.startsWith('connect-src'));
    expect(connect).toBe("connect-src 'self' https://*.payments.example https://fonts.fonts.example https://js.payments.example https://api.platform.example");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('not a host');
    expect(policy).not.toMatch(/img-src[^;]*https:(\s|;|$)/);
  });
});
