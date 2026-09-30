import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';
import type { IProcessSignalTransport } from '@core/signals/interfaces/process-signal-transport.interface';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { SiteContentRevision } from '@core/tenant/site-content-revision';

/** A transport that records what this process publishes and lets a test play another process. */
class FakeTransport implements IProcessSignalTransport {
  readonly published: any[] = [];
  private listener: ((message: string) => void) | null = null;
  failPublish = false;
  async publish(message: string) { if (this.failPublish) throw new Error('redis down'); this.published.push(JSON.parse(message)); this.listener?.(message); }
  async subscribe(onMessage: (message: string) => void) { this.listener = onMessage; }
  async close() { this.listener = null; }
  /** A message from another api process. */
  fromOther(signal: ProcessSignal, payload: Record<string, unknown> = {}) { this.listener?.(JSON.stringify({ origin: 'another-process', signal: signal.value, payload })); }
}

describe('ProcessSignals', () => {
  afterEach(async () => { await ProcessSignals.reset(); });

  it('delivers locally at once, marked local, with no transport at all', () => {
    const seen: Array<[unknown, boolean]> = [];
    const off = ProcessSignals.on(ProcessSignal.CACHE_PURGED, (payload, local) => seen.push([payload, local]));
    ProcessSignals.announce(ProcessSignal.CACHE_PURGED, { a: 1 });
    off();
    expect(seen).toEqual([[{ a: 1 }, true]]);
  });

  it('publishes to the other processes, and ignores its own message coming back', async () => {
    const transport = new FakeTransport();
    await ProcessSignals.use(transport);
    const seen: boolean[] = [];
    const off = ProcessSignals.on(ProcessSignal.CACHE_PURGED, (_p, local) => seen.push(local));
    ProcessSignals.announce(ProcessSignal.CACHE_PURGED);
    await Promise.resolve();
    off();
    expect(transport.published).toEqual([{ origin: ProcessSignals.origin, signal: 'cache-purged', payload: {} }]);
    expect(seen).toEqual([true]);
  });

  it('applies another process\'s signal, marked not local', async () => {
    const transport = new FakeTransport();
    await ProcessSignals.use(transport);
    const seen: Array<[unknown, boolean]> = [];
    const off = ProcessSignals.on(ProcessSignal.SETTINGS_WRITTEN, (payload, local) => seen.push([payload, local]));
    transport.fromOther(ProcessSignal.SETTINGS_WRITTEN, { keys: ['site_name'] });
    off();
    expect(seen).toEqual([[{ keys: ['site_name'] }, false]]);
  });

  it('a failing handler does not stop the others, and a failed publish does not throw into the write', async () => {
    const transport = new FakeTransport();
    transport.failPublish = true;
    await ProcessSignals.use(transport);
    const after = vi.fn();
    const offA = ProcessSignals.on(ProcessSignal.CACHE_PURGED, () => { throw new Error('boom'); });
    const offB = ProcessSignals.on(ProcessSignal.CACHE_PURGED, after);
    expect(() => ProcessSignals.announce(ProcessSignal.CACHE_PURGED)).not.toThrow();
    await Promise.resolve();
    offA(); offB();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('a transport that never connects holds nothing up: local delivery works meanwhile', () => {
    const neverReady: IProcessSignalTransport = { publish: async () => undefined, subscribe: () => new Promise(() => undefined), close: async () => undefined };
    void ProcessSignals.use(neverReady);
    const seen = vi.fn();
    const off = ProcessSignals.on(ProcessSignal.CACHE_PURGED, seen);
    ProcessSignals.announce(ProcessSignal.CACHE_PURGED);
    off();
    expect(seen).toHaveBeenCalledWith({}, true);
  });

  it('ignores a message that is not JSON or names no signal', async () => {
    const transport = new FakeTransport();
    await ProcessSignals.use(transport);
    const seen = vi.fn();
    const off = ProcessSignals.on(ProcessSignal.CACHE_PURGED, seen);
    (transport as any).listener('not json');
    (transport as any).listener(JSON.stringify({ origin: 'x' }));
    off();
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('caches forget what another api process changed', () => {
  afterEach(async () => { await ProcessSignals.reset(); PluginTenantAccess.reset(); TenantThemeAccess.reset(); });

  it('plugin and theme access per site', async () => {
    const transport = new FakeTransport();
    await ProcessSignals.use(transport);
    (PluginTenantAccess as any).cache.set('site-a', 'x');
    (PluginTenantAccess as any).cache.set('site-b', 'y');
    (TenantThemeAccess as any).cache.set('site-a', 'x');
    transport.fromOther(ProcessSignal.PLUGIN_ACCESS_CHANGED, { tenantId: 'site-a' });
    transport.fromOther(ProcessSignal.THEME_ACCESS_CHANGED, { tenantId: 'site-a' });
    expect([...(PluginTenantAccess as any).cache.keys()]).toEqual(['site-b']);
    expect((TenantThemeAccess as any).cache.size).toBe(0);
    transport.fromOther(ProcessSignal.PLUGIN_ACCESS_CHANGED, {});
    expect((PluginTenantAccess as any).cache.size).toBe(0);
  });

  it('the site host map', async () => {
    const transport = new FakeTransport();
    await ProcessSignals.use(transport);
    const find = vi.fn(async () => [{ id: 't1', slug: 'a', hosts: ['a.test'], status: 'active' }]);
    const resolver = TenantResolverService.shared({ find });
    await resolver.listActive();
    await resolver.listActive();
    expect(find).toHaveBeenCalledTimes(1);
    transport.fromOther(ProcessSignal.SITES_CHANGED);
    await resolver.listActive();
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('the page revision counts another process\'s change, and a local bump reaches the others', async () => {
    const transport = new FakeTransport();
    await ProcessSignals.use(transport);
    const before = SiteContentRevision.current('site-a');
    transport.fromOther(ProcessSignal.CONTENT_CHANGED, { tenantId: 'site-a' });
    const after = SiteContentRevision.current('site-a');
    expect(after).not.toBe(before);
    SiteContentRevision.bump('site-a');
    await Promise.resolve();
    expect(SiteContentRevision.current('site-a')).not.toBe(after);
    expect(transport.published.at(-1)).toMatchObject({ signal: 'content-changed', payload: { tenantId: 'site-a' } });
  });
});
