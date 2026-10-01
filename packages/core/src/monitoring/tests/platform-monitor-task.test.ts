import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformMonitorTask } from '@core/monitoring/platform-monitor-task';
import { HostResourceService } from '@core/management/host-resource-service';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { MonitoringChange } from '@core/monitoring/enums/monitoring-change.enum';
import { EnvUtils } from '@core/utils/env-utils';
import { ApiOutcomeCounter } from '@core/monitoring/api-outcome-counter';

/** `_system_meta` in memory, behind the platform-admin marker the store uses. */
class MetaTable {
  readonly rows = new Map<string, any>();
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
  async findOne(_table: string, where: { key: string }) { return this.rows.get(where.key) ?? null; }
  async update(_table: string, where: { key: string }, patch: any) { Object.assign(this.rows.get(where.key), patch); }
  async insert(_table: string, row: any) { this.rows.set(row.key, { ...row }); }
}

describe('PlatformMonitorTask', () => {
  let db: MetaTable;
  let notified: Array<{ key: string; change: string }>;
  let synced: string[][];
  let plugins: Map<string, any>;
  let failSync: boolean;
  const sites = [{ id: 'shop', slug: 'shop', primaryHost: 'shop.example', isWorkspace: false, isReadable: true }] as any[];

  beforeEach(() => {
    db = new MetaTable();
    notified = [];
    synced = [];
    failSync = false;
    plugins = new Map([['cms', { manifest: { slug: 'cms' }, state: 'active' }]]);
    vi.spyOn(HostResourceService, 'read').mockResolvedValue({ disk: { usedBytes: 10, totalBytes: 100 }, memory: { usedBytes: 10, totalBytes: 100 } } as any);
    vi.spyOn(PlatformSettingsService, 'getSetting').mockImplementation(async (key: string) => (key === 'admin_url' ? 'https://console.example' : key.startsWith('monitoring_') ? '85' : null));
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })));
    // Production: sites are watched over https (outside production the monitor uses http).
    vi.spyOn(EnvUtils, 'isProduction').mockReturnValue(true);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const fakeProvider = {
    notify: async (incident: any, change: any) => { notified.push({ key: incident.key, change: change.value }); },
    syncTargets: async (targets: any[]) => { if (failSync) throw new Error('down'); synced.push(targets.map((t) => t.url)); },
  };
  const task = () => new PlatformMonitorTask({
    db, plugins,
    integrations: { resolveMany: async () => [{ providerKey: 'fake', config: {}, provider: { create: async () => fakeProvider } }] },
  }, async () => sites);

  it('announces an incident once when it opens, not on every pass while it lasts', async () => {
    plugins.get('cms').state = 'error';
    await task().run(new Date('2026-10-01T10:00:00Z'));
    await task().run(new Date('2026-10-01T10:05:00Z'));
    expect(notified).toEqual([{ key: 'plugin-unhealthy:cms', change: MonitoringChange.OPENED.value }]);
  });

  it('keeps when an incident started while it lasts, and announces when it resolves', async () => {
    plugins.get('cms').state = 'error';
    await task().run(new Date('2026-10-01T10:00:00Z'));
    await task().run(new Date('2026-10-01T10:05:00Z'));
    const open = JSON.parse(db.rows.get('monitoring_open_incidents').value);
    expect(open[0].openedAt).toBe('2026-10-01T10:00:00.000Z');
    plugins.get('cms').state = 'active';
    const { resolved } = await task().run(new Date('2026-10-01T10:10:00Z'));
    expect(resolved[0]).toMatchObject({ key: 'plugin-unhealthy:cms', resolvedAt: '2026-10-01T10:10:00.000Z' });
    expect(notified.map((n) => n.change)).toEqual(['opened', 'resolved']);
    expect(JSON.parse(db.rows.get('monitoring_open_incidents').value)).toEqual([]);
  });

  it('treats a held plugin as unhealthy, and a 5xx or unreachable site as down — but not a 404', async () => {
    plugins.get('cms').heldReason = { value: 'capability_drift' };
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 503 });
    const { opened } = await task().run();
    expect(opened.map((i) => i.key).sort()).toEqual(['plugin-unhealthy:cms', 'site-down:shop']);
    expect(opened.find((i) => i.key === 'site-down:shop')!.values).toMatchObject({ url: 'https://shop.example/', status: 503 });
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 404 });
    const second = await task().run();
    expect(second.resolved.map((i) => i.key)).toEqual(['site-down:shop']);
  });

  it('opens a disk incident at the configured threshold, with what was measured', async () => {
    vi.spyOn(HostResourceService, 'read').mockResolvedValue({ disk: { usedBytes: 90, totalBytes: 100 }, memory: { usedBytes: 10, totalBytes: 100 } } as any);
    const { opened } = await task().run();
    expect(opened).toEqual([expect.objectContaining({ key: 'disk-full', values: expect.objectContaining({ percent: 90, threshold: 85 }) })]);
  });

  it('names the routes behind an api error incident, most failing first, with ids folded', async () => {
    ApiOutcomeCounter.drain();
    for (let i = 0; i < 16; i += 1) ApiOutcomeCounter.record(503, 'GET', `/api/v1/plugins/shop/orders/${i}?token=secret`);
    for (let i = 0; i < 8; i += 1) ApiOutcomeCounter.record(500, 'post', '/api/v1/system/admin/monitoring/check');
    ApiOutcomeCounter.record(200, 'GET', '/api/v1/health');
    const { opened } = await task().run();
    expect(opened).toEqual([expect.objectContaining({
      key: 'api-errors',
      values: expect.objectContaining({ errors: 24, total: 25, percent: 96, routes: 'GET /api/v1/plugins/shop/orders/:id (16); POST /api/v1/system/admin/monitoring/check (8)' }),
    })]);
  });

  it('syncs external providers only when the addresses change, and retries a sync that failed', async () => {
    await task().run();
    await task().run();
    expect(synced).toEqual([['https://console.example/api/v1/health', 'https://shop.example/']]);
    sites.push({ id: 'blog', slug: 'blog', primaryHost: 'blog.example', isWorkspace: false, isReadable: true });
    failSync = true;
    await task().run();
    failSync = false;
    await task().run();
    expect(synced[1]).toContain('https://blog.example/');
    sites.pop();
  });

  it('never lists a private site or a workspace for outside monitoring', async () => {
    const hidden = [...sites, { id: 'p', slug: 'p', primaryHost: 'p.example', isWorkspace: false, isReadable: false }, { id: 'w', slug: 'w', primaryHost: 'w.example', isWorkspace: true, isReadable: true }];
    const targets = await new PlatformMonitorTask({ db, plugins }, async () => hidden as any).targets();
    expect(targets.map((t) => t.url)).toEqual(['https://console.example/api/v1/health', 'https://shop.example/']);
  });
});
