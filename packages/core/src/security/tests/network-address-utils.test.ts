import { NetworkAddressUtils } from '@core/security/network-address-utils';

describe('NetworkAddressUtils.normalize', () => {
  it('unwraps the IPv4-mapped form a dual-stack socket reports', () => {
    expect(NetworkAddressUtils.normalize('::ffff:172.18.0.4')).toBe('172.18.0.4');
  });

  it('drops a port suffix from a dotted host:port pair', () => {
    expect(NetworkAddressUtils.normalize('10.1.2.3:54321')).toBe('10.1.2.3');
  });

  it('leaves a bare IPv6 address intact', () => {
    expect(NetworkAddressUtils.normalize('::1')).toBe('::1');
  });

  it('unwraps a bracketed IPv6 address', () => {
    expect(NetworkAddressUtils.normalize('[::1]')).toBe('::1');
  });
});

describe('NetworkAddressUtils.matches', () => {
  it('matches an exact address', () => {
    expect(NetworkAddressUtils.matches('10.0.0.5', '10.0.0.5')).toBe(true);
    expect(NetworkAddressUtils.matches('10.0.0.6', '10.0.0.5')).toBe(false);
  });

  it('matches inside an IPv4 CIDR block', () => {
    expect(NetworkAddressUtils.matches('172.18.0.4', '172.16.0.0/12')).toBe(true);
    expect(NetworkAddressUtils.matches('172.31.255.254', '172.16.0.0/12')).toBe(true);
  });

  it('rejects an address just outside the block', () => {
    expect(NetworkAddressUtils.matches('172.32.0.1', '172.16.0.0/12')).toBe(false);
    expect(NetworkAddressUtils.matches('172.15.255.255', '172.16.0.0/12')).toBe(false);
  });

  it('handles the high half of the address space without sign overflow', () => {
    expect(NetworkAddressUtils.matches('200.0.0.1', '200.0.0.0/8')).toBe(true);
    expect(NetworkAddressUtils.matches('201.0.0.1', '200.0.0.0/8')).toBe(false);
  });

  it('rejects a malformed pattern rather than matching everything', () => {
    expect(NetworkAddressUtils.matches('10.0.0.5', '10.0.0.0/99')).toBe(false);
    expect(NetworkAddressUtils.matches('10.0.0.5', 'not-an-address')).toBe(false);
    expect(NetworkAddressUtils.matches('10.0.0.5', '')).toBe(false);
  });

  it('rejects an octet outside 0-255', () => {
    expect(NetworkAddressUtils.matches('10.0.0.300', '10.0.0.0/8')).toBe(false);
  });
});

describe('NetworkAddressUtils.isPrivate', () => {
  it('accepts loopback and the RFC1918 ranges', () => {
    for (const address of ['127.0.0.1', '::1', '10.4.5.6', '192.168.1.10', '172.20.0.9', '::ffff:172.20.0.9']) {
      expect(NetworkAddressUtils.isPrivate(address)).toBe(true);
    }
  });

  it('rejects public addresses', () => {
    for (const address of ['8.8.8.8', '203.0.113.9', '172.32.0.1', '']) {
      expect(NetworkAddressUtils.isPrivate(address)).toBe(false);
    }
  });
});

describe('NetworkAddressUtils.parseList', () => {
  it('splits on commas, whitespace and newlines', () => {
    expect(NetworkAddressUtils.parseList('10.0.0.0/8, ::1\n192.168.0.0/16 ; 127.0.0.1'))
      .toEqual(['10.0.0.0/8', '::1', '192.168.0.0/16', '127.0.0.1']);
  });

  it('returns nothing for a blank list', () => {
    expect(NetworkAddressUtils.parseList('   ')).toEqual([]);
    expect(NetworkAddressUtils.parseList(undefined)).toEqual([]);
  });
});

describe('NetworkAddressUtils.matchesAny', () => {
  it('matches nothing when the allowlist is empty', () => {
    expect(NetworkAddressUtils.matchesAny('10.0.0.5', [])).toBe(false);
    expect(NetworkAddressUtils.matchesAny('10.0.0.5', undefined)).toBe(false);
  });
});

describe('NetworkAddressUtils.matchEdgeProvider', () => {
  it('finds the registered Cloudflare provider for an address inside its published IPv4 range', () => {
    expect(NetworkAddressUtils.matchEdgeProvider('104.16.0.1')?.key).toBe('cloudflare');
  });

  it('finds the registered Cloudflare provider for an address inside its published IPv6 range', () => {
    expect(NetworkAddressUtils.matchEdgeProvider('2606:4700::1')?.key).toBe('cloudflare');
  });

  it('matches nothing for an address outside every registered provider', () => {
    expect(NetworkAddressUtils.matchEdgeProvider('8.8.8.8')).toBeNull();
  });

  it('matches an operator-declared extra range for a provider, keyed by its own provider key', () => {
    expect(NetworkAddressUtils.matchEdgeProvider('203.0.113.9', { cloudflare: ['203.0.113.0/24'] })?.key)
      .toBe('cloudflare');
  });

  it('does not credit an extra range declared under the wrong provider key', () => {
    expect(NetworkAddressUtils.matchEdgeProvider('203.0.113.9', { 'some-other-provider': ['203.0.113.0/24'] }))
      .toBeNull();
  });
});

describe('NetworkAddressUtils.resolveClientIp', () => {
  it("trusts the matched provider's own header when the chain shows the request transited its edge", () => {
    // 104.16.0.1 is inside Cloudflare's published 104.16.0.0/13 edge range — this is what `req.ip`
    // resolves to when the trust-proxy walk stops at Cloudflare's own edge address, and Cloudflare's
    // provider declares `cf-connecting-ip` as ITS trusted header, never hardcoded in this method.
    expect(NetworkAddressUtils.resolveClientIp({
      ip: '104.16.0.1',
      headers: { 'cf-connecting-ip': '203.0.113.42' },
    })).toBe('203.0.113.42');
  });

  it('ignores the trusted header on a request that did not arrive through a known edge provider', () => {
    // A direct connection to the origin (bypassing Cloudflare entirely) forging the header must not
    // get to claim an arbitrary IP — 203.0.113.9 is not a Cloudflare address, so the header is ignored.
    expect(NetworkAddressUtils.resolveClientIp({
      ip: '203.0.113.9',
      headers: { 'cf-connecting-ip': '198.51.100.7' },
    })).toBe('203.0.113.9');
  });

  it('falls back to req.ip unchanged when there is no trusted header at all', () => {
    // The non-Cloudflare-proxied case — most hosts on this platform still are not behind Cloudflare.
    expect(NetworkAddressUtils.resolveClientIp({ ip: '203.0.113.9', headers: {} })).toBe('203.0.113.9');
    expect(NetworkAddressUtils.resolveClientIp({ ip: '203.0.113.9' })).toBe('203.0.113.9');
  });

  it('falls back to req.ip when the matched provider header holds a malformed, non-IP value', () => {
    // The chain proves the hop transited Cloudflare's edge, but the header value itself is garbage —
    // it must never be trusted verbatim; this must behave exactly like the no-header case.
    expect(NetworkAddressUtils.resolveClientIp({
      ip: '104.16.0.1',
      headers: { 'cf-connecting-ip': 'not-an-ip' },
    })).toBe('104.16.0.1');
  });

  it('honours operator-declared extra ranges, keyed by provider, for a header not yet in the hardcoded list', () => {
    expect(NetworkAddressUtils.resolveClientIp(
      { ip: '203.0.113.9', headers: { 'cf-connecting-ip': '198.51.100.7' } },
      { cloudflare: ['203.0.113.0/24'] },
    )).toBe('198.51.100.7');
  });
});
