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
