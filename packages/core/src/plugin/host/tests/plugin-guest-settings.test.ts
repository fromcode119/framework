import { describe, expect, it, vi } from 'vitest';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginGuestSettings } from '@core/plugin/host/plugin-guest-settings';

const invocation = <T>(token: string, fn: () => Promise<T>) => PluginGuestRemote.invocation.run({ token, tenantId: 't1' }, fn);

function settings(values: Record<string, unknown> = { storeCurrency: 'EUR' }) {
  let stored = { ...values };
  const base = {
    get: vi.fn(async () => ({ ...stored })),
    update: vi.fn(async (next: Record<string, unknown>) => { stored = { ...stored, ...next }; }),
    register: vi.fn(async () => undefined),
  };
  return { base, proxy: new PluginGuestSettings(base).proxy() as any };
}

describe('PluginGuestSettings', () => {
  it('reads the settings once per invocation, however many times the plugin asks', async () => {
    const { base, proxy } = settings();
    const answers = await invocation('route:a', () => Promise.all([proxy.get(), proxy.get(), proxy.get()]));
    expect(base.get).toHaveBeenCalledTimes(1);
    expect(answers).toEqual([{ storeCurrency: 'EUR' }, { storeCurrency: 'EUR' }, { storeCurrency: 'EUR' }]);
  });

  it('gives every caller its own copy', async () => {
    const { proxy } = settings();
    await invocation('route:a', async () => {
      const first = await proxy.get();
      first.storeCurrency = 'changed by one caller';
      expect(await proxy.get()).toEqual({ storeCurrency: 'EUR' });
    });
  });

  it('reads again in the next invocation — a save is seen by the very next request', async () => {
    const { base, proxy } = settings();
    await invocation('route:a', () => proxy.get());
    await base.update({ storeCurrency: 'USD' });
    expect(await invocation('route:b', () => proxy.get())).toEqual({ storeCurrency: 'USD' });
    expect(base.get).toHaveBeenCalledTimes(2);
  });

  it('forgets the invocation\'s reads when the plugin updates its own settings', async () => {
    const { base, proxy } = settings();
    await invocation('route:a', async () => {
      await proxy.get();
      await proxy.update({ storeCurrency: 'USD' });
      expect(await proxy.get()).toEqual({ storeCurrency: 'USD' });
    });
    expect(base.get).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed read', async () => {
    const { base, proxy } = settings();
    base.get.mockRejectedValueOnce(new Error('channel busy'));
    await invocation('route:a', async () => {
      await expect(proxy.get()).rejects.toThrow('channel busy');
      expect(await proxy.get()).toEqual({ storeCurrency: 'EUR' });
    });
  });

  it('reads straight through outside any invocation, and passes other members on', async () => {
    const { base, proxy } = settings();
    await proxy.get();
    await proxy.get();
    expect(base.get).toHaveBeenCalledTimes(2);
    await proxy.register({ fields: [] });
    expect(base.register).toHaveBeenCalledTimes(1);
  });
});

/**
 * Kept across requests: the api sends each invocation its site's content revision and the operator's
 * maximum age. A product list read the shop's settings once per request; repeats under one revision
 * now share that read, and any save moves the revision.
 */
describe('PluginGuestSettings, kept per site and revision', () => {
  const at = <T>(tenantId: string | null, revision: string | undefined, fn: () => Promise<T>, cacheMaxAgeMs = 60_000) =>
    PluginGuestRemote.invocation.run({ token: `t${Math.random()}`, tenantId, revision, cacheMaxAgeMs }, fn);

  it('shares one read between requests of the same site and revision', async () => {
    const { base, proxy } = settings();
    for (let i = 0; i < 3; i += 1) expect(await at('t1', 'r1', () => proxy.get())).toEqual({ storeCurrency: 'EUR' });
    expect(base.get).toHaveBeenCalledTimes(1);
  });

  it('reads again under a new revision — a save anywhere is seen by the next request that carries it', async () => {
    const { base, proxy } = settings();
    await at('t1', 'r1', () => proxy.get());
    await base.update({ storeCurrency: 'USD' });
    expect(await at('t1', 'r2', () => proxy.get())).toEqual({ storeCurrency: 'USD' });
    expect(base.get).toHaveBeenCalledTimes(2);
  });

  it('never answers one site with another site\'s read', async () => {
    const values: Record<string, string> = { shop: 'EUR', blog: 'GBP' };
    const base = { get: vi.fn(async () => ({ storeCurrency: values[String(PluginGuestRemote.invocation.getStore()?.tenantId)] })), update: vi.fn() };
    const proxy = new PluginGuestSettings(base).proxy() as any;
    expect(await at('shop', 'r1', () => proxy.get())).toEqual({ storeCurrency: 'EUR' });
    expect(await at('blog', 'r1', () => proxy.get())).toEqual({ storeCurrency: 'GBP' });
    expect(await at('shop', 'r1', () => proxy.get())).toEqual({ storeCurrency: 'EUR' });
    expect(base.get).toHaveBeenCalledTimes(2);
  });

  it('keeps nothing when the operator turned the cache off, or past its age', async () => {
    const { base, proxy } = settings();
    await at('t1', 'r1', () => proxy.get(), 0);
    await at('t1', 'r1', () => proxy.get(), 0);
    expect(base.get).toHaveBeenCalledTimes(2);

    vi.useFakeTimers();
    try {
      await at('t1', 'r9', () => proxy.get(), 1000);
      vi.advanceTimersByTime(1001);
      await at('t1', 'r9', () => proxy.get(), 1000);
      expect(base.get).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets what it kept for the site when the plugin saves its own settings', async () => {
    const { base, proxy } = settings();
    await at('t1', 'r1', () => proxy.get());
    await at('t1', 'r1', () => proxy.update({ storeCurrency: 'USD' }));
    // A request still under the old revision (in flight before the bump reached it) reads the save.
    expect(await at('t1', 'r1', () => proxy.get())).toEqual({ storeCurrency: 'USD' });
  });

  it('does not keep a failed read', async () => {
    const { base, proxy } = settings();
    base.get.mockRejectedValueOnce(new Error('channel busy'));
    await expect(at('t1', 'r1', () => proxy.get())).rejects.toThrow('channel busy');
    expect(await at('t1', 'r1', () => proxy.get())).toEqual({ storeCurrency: 'EUR' });
  });
});
