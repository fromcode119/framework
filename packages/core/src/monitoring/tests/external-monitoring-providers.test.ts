import { afterEach, describe, expect, it, vi } from 'vitest';
import { UptimeRobotMonitoringProvider } from '@core/monitoring/providers/uptimerobot-monitoring-provider';
import { BetterStackMonitoringProvider } from '@core/monitoring/providers/betterstack-monitoring-provider';

/**
 * An external provider keeps exactly the platform's monitors in sync with its addresses: it adds what is
 * missing, removes the platform's monitors for addresses that are gone — and never touches a monitor
 * the platform did not create (no prefix), whatever its address.
 */
const targets = [
  { key: 'shop', label: 'shop', url: 'https://shop.example/' },
  { key: 'new', label: 'new', url: 'https://new.example/' },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe('UptimeRobotMonitoringProvider', () => {
  /** A v3 account: two pages of monitors, the second reached by `nextLink`. */
  const account = (pages: any[][]) => {
    const calls: Array<{ method: string; url: string; auth: string; body: any }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ method: init.method, url, auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : null });
      if (init.method === 'GET') {
        const page = new URL(url).searchParams.get('cursor') ? 1 : 0;
        return { ok: true, status: 200, json: async () => ({ data: pages[page], nextLink: page + 1 < pages.length ? 'https://api.uptimerobot.com/v3/monitors?cursor=2' : null }) };
      }
      return { ok: true, status: 200, json: async () => ({ id: 99 }) };
    }));
    return calls;
  };

  it('adds missing sites, removes only its own stale monitors across pages, and leaves every other monitor alone', async () => {
    const calls = account([
      [{ id: 1, url: 'https://shop.example/', friendlyName: 'Platform: shop' }, { id: 3, url: 'https://gone.example/', friendlyName: 'My own personal monitor' }],
      [{ id: 2, url: 'https://gone.example/', friendlyName: 'Platform: gone' }],
    ]);
    await new UptimeRobotMonitoringProvider('key-1', 'Platform: ', 300, 30).syncTargets(targets);
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual(['https://api.uptimerobot.com/v3/monitors/2']);
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([{ type: 'HTTP', url: 'https://new.example/', friendlyName: 'Platform: new', interval: 300, timeout: 30 }]);
    expect(calls.every((c) => c.auth === 'Bearer key-1')).toBe(true);
  });

  it('sends no interval or timeout when none is configured', async () => {
    const calls = account([[]]);
    await new UptimeRobotMonitoringProvider('key-1', 'Platform: ').syncTargets(targets);
    expect(calls.filter((c) => c.method === 'POST').every((c) => !('interval' in c.body) && !('timeout' in c.body))).toBe(true);
  });

  it('never follows a next page to another host, which would hand it the key', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ data: [], nextLink: url.includes('evil') ? null : 'https://evil.example/steal' }) })));
    await new UptimeRobotMonitoringProvider('key-1', 'Platform: ').syncTargets([]);
    expect((globalThis.fetch as any).mock.calls.map((c: any[]) => new URL(c[0]).host)).toEqual(['api.uptimerobot.com']);
  });

  it('fails loudly on an API error rather than reporting a sync that did not happen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ message: 'Invalid API key' }) })));
    await expect(new UptimeRobotMonitoringProvider('bad', 'Platform: ').syncTargets(targets)).rejects.toThrow(/Invalid API key/);
  });
});

describe('BetterStackMonitoringProvider', () => {
  it('adds missing sites, removes only its own stale monitors across pages, and leaves every other monitor alone', async () => {
    const calls: Array<{ method: string; url: string; body?: any }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ method: init.method, url, body: init.body ? JSON.parse(init.body) : undefined });
      if (init.method === 'GET' && !url.includes('page=2')) {
        return { ok: true, status: 200, json: async () => ({ data: [
          { id: '10', attributes: { url: 'https://shop.example/', pronounceable_name: 'Platform: shop' } },
          { id: '11', attributes: { url: 'https://gone.example/', pronounceable_name: 'Someone else' } },
        ], pagination: { next: 'https://uptime.betterstack.com/api/v2/monitors?page=2' } }) };
      }
      if (init.method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ data: [{ id: '12', attributes: { url: 'https://gone.example/', pronounceable_name: 'Platform: gone' } }], pagination: { next: null } }) };
      }
      return { ok: true, status: init.method === 'DELETE' ? 204 : 201, json: async () => ({}) };
    }));
    await new BetterStackMonitoringProvider('token-1', 'Platform: ').syncTargets(targets);
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual(['https://uptime.betterstack.com/api/v2/monitors/12']);
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([{ monitor_type: 'status', url: 'https://new.example/', pronounceable_name: 'Platform: new' }]);
    expect((globalThis.fetch as any).mock.calls.every(([, init]: any) => init.headers.Authorization === 'Bearer token-1')).toBe(true);
  });
});
