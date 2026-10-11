import { describe, expect, it } from 'vitest';
import { GatewayRateLimit } from '@cli/services/gateway/challenge/gateway-rate-limit';

describe('GatewayRateLimit', () => {
  it('lets a visitor make the configured number of requests a minute, then says how long to wait', () => {
    let now = 1_000_000;
    const limit = new GatewayRateLimit(() => now);
    for (let i = 0; i < 3; i += 1) expect(limit.retryAfter('203.0.113.7', 3)).toBe(0);
    now += 20_000;
    expect(limit.retryAfter('203.0.113.7', 3)).toBe(40);
    // Another visitor has a budget of its own.
    expect(limit.retryAfter('203.0.113.8', 3)).toBe(0);
    // A new minute starts a new window.
    now += 40_000;
    expect(limit.retryAfter('203.0.113.7', 3)).toBe(0);
  });

  it('counts nothing when the limit is 0, and never counts the platform\'s own servers', () => {
    const limit = new GatewayRateLimit(() => 0);
    for (let i = 0; i < 50; i += 1) expect(limit.retryAfter('203.0.113.7', 0)).toBe(0);
    for (let i = 0; i < 50; i += 1) expect(limit.retryAfter('172.18.0.5', 1)).toBe(0);
    for (let i = 0; i < 50; i += 1) expect(limit.retryAfter('::ffff:10.0.0.4', 1)).toBe(0);
  });

  it('treats the IPv4-mapped form of an address as the same visitor', () => {
    const limit = new GatewayRateLimit(() => 0);
    expect(limit.retryAfter('203.0.113.7', 1)).toBe(0);
    expect(limit.retryAfter('::ffff:203.0.113.7', 1)).toBeGreaterThan(0);
  });
});
