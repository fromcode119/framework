import { describe, expect, it } from 'vitest';
import { GatewayScannerBan } from '@cli/services/gateway/challenge/gateway-scanner-ban';

describe('GatewayScannerBan', () => {
  it('stops an address on the configured strike and lets it go when the minutes are over', () => {
    let now = 0;
    const ban = new GatewayScannerBan(() => now);
    expect(ban.strike('203.0.113.1', 2, 1)).toBe(false);
    expect(ban.isBanned('203.0.113.1')).toBe(false);
    expect(ban.strike('203.0.113.1', 2, 1)).toBe(true);
    expect(ban.isBanned('203.0.113.1')).toBe(true);
    now += 60_000;
    expect(ban.isBanned('203.0.113.1')).toBe(false);
    expect(ban.strike('203.0.113.1', 2, 1)).toBe(false);
  });

  it('forgets strikes older than ten minutes', () => {
    let now = 0;
    const ban = new GatewayScannerBan(() => now);
    ban.strike('203.0.113.2', 2, 5);
    now += 10 * 60_000;
    expect(ban.strike('203.0.113.2', 2, 5)).toBe(false);
    expect(ban.isBanned('203.0.113.2')).toBe(false);
  });

  it('is off at 0 and never counts a private address', () => {
    const ban = new GatewayScannerBan();
    for (let i = 0; i < 5; i += 1) ban.strike('203.0.113.3', 0, 60);
    expect(ban.isBanned('203.0.113.3')).toBe(false);
    for (let i = 0; i < 5; i += 1) ban.strike('172.18.0.4', 1, 60);
    expect(ban.isBanned('172.18.0.4')).toBe(false);
  });
});
