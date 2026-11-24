import { describe, expect, it } from 'vitest';
import { EdgeStopStore } from '@core/security/edge/edge-stop-store';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

/** `_system_edge_stops` in memory: what the store asks of the database, nothing more. */
class MemoryDb {
  rows: Array<Record<string, any>> = [];
  async find(_table: string, options: { limit?: number }) {
    return [...this.rows].sort((a, b) => b.id - a.id).slice(0, options.limit);
  }
  async findOne(_table: string, where: { id: number }) {
    return this.rows.find((row) => row.id === where.id) ?? null;
  }
  async insert(_table: string, data: Record<string, any>) {
    this.rows.push({ id: this.rows.length + 1, released_at: null, ...data });
  }
  async update(_table: string, where: { id: number }, data: Record<string, any>) {
    Object.assign(this.rows.find((row) => row.id === where.id)!, data);
  }
}

describe('EdgeStopStore', () => {
  const report = (address: string, until: number, extra: Record<string, unknown> = {}) => ({ address, reason: 'scanner_stopped', until: new Date(until).toISOString(), strikes: 5, hosts: ['shop.test'], paths: ['/.env'], ...extra });

  it('records a stop, carries it to the gateway, and ends it when released', async () => {
    const now = 1_000_000;
    const db = new MemoryDb();
    const store = new EdgeStopStore(db, () => now);
    const recorded = await store.record(report('203.0.113.20', now + 60_000));
    expect(recorded).toMatchObject({ address: '203.0.113.20', active: true, isNew: true, hosts: ['shop.test'], paths: ['/.env'], strikes: 5 });
    expect((await store.stops()).map((stop) => stop.address)).toEqual(['203.0.113.20']);

    await store.addRefused({ '203.0.113.20': 7, '203.0.113.99': 3 });
    expect((await store.list())[0].refused).toBe(7);

    expect(await store.release(recorded!.id, 'ops@example.test', 'released')).toBe(true);
    expect(await store.stops()).toEqual([]);
    expect((await store.list())[0]).toMatchObject({ active: false, releaseAction: 'released', releasedBy: 'ops@example.test' });
    // Released already: nothing to do, and the caller is told so.
    expect(await store.release(recorded!.id, 'ops@example.test', 'released')).toBe(false);
  });

  it('extends the open stop when a second gateway reports the same address, instead of adding a row', async () => {
    const now = 1_000_000;
    const db = new MemoryDb();
    const store = new EdgeStopStore(db, () => now);
    await store.record(report('203.0.113.21', now + 60_000));
    const second = await store.record(report('203.0.113.21', now + 120_000, { hosts: ['blog.test'], paths: ['/.git/HEAD'] }));
    expect(second?.isNew).toBe(false);
    expect(db.rows).toHaveLength(1);
    expect((await store.list())[0]).toMatchObject({ until: new Date(now + 120_000).toISOString(), hosts: ['shop.test', 'blog.test'], paths: ['/.env', '/.git/HEAD'] });
  });

  it('refuses a report it cannot trust: a private address, an end already past, no address at all', async () => {
    const now = 1_000_000;
    const store = new EdgeStopStore(new MemoryDb(), () => now);
    expect(await store.record(report('10.0.0.5', now + 60_000))).toBeNull();
    expect(await store.record(report('203.0.113.22', now - 1))).toBeNull();
    expect(await store.record(report('', now + 60_000))).toBeNull();
  });

  it('keeps a list from a report to ten short entries', async () => {
    const now = 1_000_000;
    const store = new EdgeStopStore(new MemoryDb(), () => now);
    const paths = Array.from({ length: 30 }, (_, i) => `/${i}-${"x".repeat(300)}`);
    const stop = await store.record(report('203.0.113.23', now + 60_000, { paths }));
    expect(stop!.paths).toHaveLength(10);
    expect(stop!.paths.every((path) => path.length <= 200)).toBe(true);
  });

  it('travels in the routing map', async () => {
    const now = Date.now();
    const store = new EdgeStopStore(new MemoryDb(), () => now);
    await store.record(report('203.0.113.24', now + 60_000));
    const map = TenantRouteMap.fromJson(JSON.parse(JSON.stringify(new TenantRouteMap([]).withStops(await store.stops()))));
    expect(map.stops.map((stop) => [stop.address, stop.until])).toEqual([['203.0.113.24', now + 60_000]]);
    expect(TenantRouteMap.fromJson({ routes: [] }).stops).toEqual([]);
  });
});
