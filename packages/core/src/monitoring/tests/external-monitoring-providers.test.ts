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
  it('adds missing sites, removes only its own stale monitors, and leaves every other monitor alone', async () => {
    const calls: Array<{ method: string; params: Record<string, string> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      const method = url.split('/').pop()!;
      const params = Object.fromEntries(new URLSearchParams(init.body));
      calls.push({ method, params });
      const body = method === 'getMonitors'
        ? { stat: 'ok', monitors: [
          { id: 1, url: 'https://shop.example/', friendly_name: 'Platform: shop' },
          { id: 2, url: 'https://gone.example/', friendly_name: 'Platform: gone' },
          { id: 3, url: 'https://gone.example/', friendly_name: 'My own personal monitor' },
        ] }
        : { stat: 'ok' };
      return { ok: true, status: 200, json: async () => body };
    }));
    await new UptimeRobotMonitoringProvider('key-1', 'Platform: ').syncTargets(targets);
    expect(calls.filter((c) => c.method === 'deleteMonitor').map((c) => c.params.id)).toEqual(['2']);
    expect(calls.filter((c) => c.method === 'newMonitor').map((c) => [c.params.url, c.params.friendly_name])).toEqual([['https://new.example/', 'Platform: new']]);
    expect(calls.every((c) => c.params.api_key === 'key-1')).toBe(true);
  });

  it('creates each monitor at the configured check interval, which the free plan requires to be 300 or more', async () => {
    const created: Array<Record<string, string>> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      const method = url.split('/').pop()!;
      if (method === 'newMonitor') created.push(Object.fromEntries(new URLSearchParams(init.body)));
      return { ok: true, status: 200, json: async () => (method === 'getMonitors' ? { stat: 'ok', monitors: [] } : { stat: 'ok' }) };
    }));
    await new UptimeRobotMonitoringProvider('key-1', 'Platform: ', 300).syncTargets(targets);
    expect(created.map((c) => c.interval)).toEqual(targets.map(() => '300'));
    created.length = 0;
    await new UptimeRobotMonitoringProvider('key-1', 'Platform: ').syncTargets(targets);
    expect(created.every((c) => !('interval' in c))).toBe(true);
  });

  it('fails loudly on an API error rather than reporting a sync that did not happen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ stat: 'fail', error: { message: 'api_key is wrong' } }) })));
    await expect(new UptimeRobotMonitoringProvider('bad', 'Platform: ').syncTargets(targets)).rejects.toThrow(/api_key is wrong/);
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
