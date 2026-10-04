import { afterEach, describe, expect, it } from 'vitest';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { ApplicationUrlResolver } from '@core/application-url-resolver';

/** Parsed once and remembered: the answers must be the same on the first call and on every later one. */
describe('address patterns parsed once', () => {
  it('answers exact, CIDR, catch-all and invalid patterns the same way on every call', () => {
    const cases: Array<[string, string, boolean]> = [
      ['10.1.2.3', '10.0.0.0/8', true],
      ['11.1.2.3', '10.0.0.0/8', false],
      ['192.168.5.9', '192.168.5.9', true],
      ['::ffff:192.168.5.9', '192.168.5.9', true],
      ['8.8.8.8', '0.0.0.0/0', true],
      ['8.8.8.8', '1.2.3.4/33', false],
      ['8.8.8.8', 'not-an-ip/8', false],
      ['2001:db8::1', '10.0.0.0/8', false],
    ];
    for (let round = 0; round < 3; round += 1) {
      for (const [address, pattern, expected] of cases) expect(NetworkAddressUtils.matches(address, pattern)).toBe(expected);
    }
  });

  it('a split list cannot be changed by its caller', () => {
    const first = NetworkAddressUtils.parseList('10.0.0.0/8, 172.16.0.0/12');
    first.push('evil');
    expect(NetworkAddressUtils.parseList('10.0.0.0/8, 172.16.0.0/12')).toEqual(['10.0.0.0/8', '172.16.0.0/12']);
  });
});

describe('edge provider per address, remembered', () => {
  it('answers the same on every call, and a changed declaration of extra ranges is matched afresh', () => {
    const cloudflare = '173.245.48.1';
    for (let round = 0; round < 3; round += 1) {
      expect(NetworkAddressUtils.matchEdgeProvider(cloudflare)?.key).toBe('cloudflare');
      expect(NetworkAddressUtils.matchEdgeProvider('8.8.8.8')).toBeNull();
    }
    const declared = { cloudflare: ['8.8.8.0/24'] };
    expect(NetworkAddressUtils.matchEdgeProvider('8.8.8.8', declared)?.key).toBe('cloudflare');
    expect(NetworkAddressUtils.matchEdgeProvider('8.8.8.8', { cloudflare: [] })).toBeNull();
    expect(NetworkAddressUtils.matchEdgeProvider('8.8.8.8')).toBeNull();
  });
});

describe('app base path from the environment, remembered', () => {
  const saved = { API_URL: process.env.API_URL, ADMIN_URL: process.env.ADMIN_URL };
  afterEach(() => { process.env.API_URL = saved.API_URL; process.env.ADMIN_URL = saved.ADMIN_URL; if (saved.API_URL === undefined) delete process.env.API_URL; if (saved.ADMIN_URL === undefined) delete process.env.ADMIN_URL; });

  it('follows a changed environment instead of keeping the first answer', () => {
    process.env.ADMIN_URL = 'https://example.test/console';
    expect(ApplicationUrlResolver.readAppBasePathFromEnvironment('admin')).toBe('/console');
    expect(ApplicationUrlResolver.readAppBasePathFromEnvironment('admin')).toBe('/console');
    process.env.ADMIN_URL = 'https://example.test/manage';
    expect(ApplicationUrlResolver.readAppBasePathFromEnvironment('admin')).toBe('/manage');
  });
});
