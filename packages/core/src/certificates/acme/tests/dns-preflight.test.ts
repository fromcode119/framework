import { describe, expect, it } from 'vitest';
import { DnsPreflight } from '@core/certificates/acme/dns-preflight';

/**
 * The guard that stands between this platform and a certificate authority's failure budget.
 *
 * Every "does not point here" verdict is an order NOT placed. Let's Encrypt refuses a hostname after
 * five failed validations in an hour, and the refusal outlasts whatever caused it — so the cost of
 * being wrong here is being locked out of a customer's domain while trying to fix it.
 */
describe('DnsPreflight — may we order a certificate for this host yet', () => {
  const resolver = (ipv4: string[], ipv6: string[] = []) => ({
    resolve4: async () => { if (!ipv4.length) throw new Error('ENODATA'); return ipv4; },
    resolve6: async () => { if (!ipv6.length) throw new Error('ENODATA'); return ipv6; },
  });

  const platform = ['88.99.185.7', '2a01:4f8:1c1e:8865::1'];

  it('passes a host pointing at a declared address', async () => {
    const result = await new DnsPreflight(resolver(['88.99.185.7'])).check('shop.test', platform);
    expect(result.isPointingHere).toBe(true);
    expect(result.describe()).toBe('');
  });

  it('passes a host pointing at BOTH declared addresses', async () => {
    const result = await new DnsPreflight(resolver(['88.99.185.7'], ['2a01:4f8:1c1e:8865::1'])).check('shop.test', platform);
    expect(result.isPointingHere).toBe(true);
  });

  it('blocks a host that does not resolve at all, and says so', async () => {
    const result = await new DnsPreflight(resolver([])).check('shop.test', platform);
    expect(result.isPointingHere).toBe(false);
    expect(result.describe()).toContain('Does not resolve yet');
    expect(result.describe()).toContain('resolves to nothing');
  });

  it('blocks a host pointing at somebody else, and names both sides', async () => {
    const result = await new DnsPreflight(resolver(['203.0.113.9'])).check('shop.test', platform);
    expect(result.isPointingHere).toBe(false);
    expect(result.describe()).toContain('203.0.113.9');
    expect(result.describe()).toContain('88.99.185.7');
  });

  it('BLOCKS a correct A record when a stray AAAA points elsewhere', async () => {
    // The subtle one: authorities prefer IPv6 when a AAAA exists, so this host validates against the
    // OLD server and fails — while every check run from a v4-only machine says the DNS is perfect.
    const result = await new DnsPreflight(resolver(['88.99.185.7'], ['2001:db8::dead'])).check('shop.test', platform);
    expect(result.isPointingHere).toBe(false);
    expect(result.describe()).toContain('2001:db8::dead');
  });

  it('refuses to judge anything when no platform address is declared', async () => {
    const result = await new DnsPreflight(resolver(['88.99.185.7'])).check('shop.test', []);
    expect(result.isPointingHere).toBe(false);
    expect(result.describe()).toContain('No platform address is declared');
  });

  it('treats a differently-cased IPv6 answer as the same address', async () => {
    const result = await new DnsPreflight(resolver([], ['2A01:4F8:1C1E:8865::1'])).check('shop.test', platform);
    expect(result.isPointingHere).toBe(true);
  });
});
