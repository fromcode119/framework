import { describe, expect, it } from 'vitest';
import { EdgeStop } from '@fromcode119/core';
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

  it('describes a stop with what it asked for, for the console', () => {
    const ban = new GatewayScannerBan(() => 0);
    ban.strike('203.0.113.10', 2, 1, 'shop.test', '/.env');
    ban.strike('203.0.113.10', 2, 1, 'blog.test', '/.git/HEAD');
    expect(ban.describe('203.0.113.10')).toEqual({ address: '203.0.113.10', until: new Date(60_000).toISOString(), strikes: 2, hosts: ['shop.test', 'blog.test'], paths: ['/.env', '/.git/HEAD'] });
    expect(ban.describe('203.0.113.11')).toBeNull();
  });

  it('takes the recorded stops from the routing map, so a restarted gateway keeps refusing them', () => {
    const ban = new GatewayScannerBan(() => 1_000);
    ban.sync([new EdgeStop('203.0.113.12', 3_600_000), new EdgeStop('203.0.113.13', 500)]);
    expect(ban.isBanned('203.0.113.12')).toBe(true);
    // Already over: not stopped.
    expect(ban.isBanned('203.0.113.13')).toBe(false);
  });

  it('ends a stop the map no longer carries once it has had time to be recorded (released in the console)', () => {
    let now = 0;
    const ban = new GatewayScannerBan(() => now);
    ban.strike('203.0.113.14', 1, 60);
    // Not yet recorded: a map fetched in the meantime does not end it.
    ban.sync([]);
    expect(ban.isBanned('203.0.113.14')).toBe(true);
    now += GatewayScannerBan.UNRECORDED_GRACE_MS;
    ban.sync([new EdgeStop('203.0.113.14', now + 60_000)]);
    expect(ban.isBanned('203.0.113.14')).toBe(true);
    // Released: the next map leaves it out.
    ban.sync([]);
    expect(ban.isBanned('203.0.113.14')).toBe(false);
  });
});
