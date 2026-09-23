import { describe, expect, it, vi } from 'vitest';
import { PluginGuestLocals } from '@core/plugin/host/plugin-guest-locals';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';

/**
 * An ISOLATED plugin's `context.i18n.registerTranslations` writes to a LOCAL `I18nManager` so
 * `t()`/`translateOrFallback()` can keep answering synchronously — but that local map is the only
 * writer, so the host's own i18n map (the one `getI18n` in system-runtime-controller reads) never
 * saw a single key for an isolated plugin, and every locale request answered `{}`.
 *
 * `PluginGuestLocals` must forward every registration to the host's `context.i18n.registerTranslations`
 * two-argument form, and `flush()` must wait for those forwards before a lifecycle hook is reported
 * done — otherwise the first request after boot can still race the forward and see an empty map.
 *
 * Fictional plugin fixture only (`alpha`), never a real plugin slug.
 */
const boot = (): IPluginGuestBoot => ({
  slug: 'alpha',
  pluginDir: '/tmp/alpha',
  entryPath: '/tmp/alpha/index.js',
  manifest: { slug: 'alpha' },
  socketPath: '/tmp/alpha.sock',
  socketMode: 0o600,
  plugin: { slug: 'alpha', namespace: 'example', version: '1.0.0', dataDir: '/tmp/alpha/data', rootDir: '/tmp/alpha', config: {} },
  projectRoot: '/tmp',
  defaultLocale: 'en',
});

describe('PluginGuestLocals i18n forwarding', () => {
  it('forwards each registered locale payload to the host, namespaced by the two-arg form', async () => {
    const registerTranslations = vi.fn(async () => undefined);
    const remote: any = {
      // The constructor also refs `db`; only the `i18n` ref carries our forwarding contract.
      ref: vi.fn((root: string, steps: Array<{ name: string }>) => {
        expect(root).toBe('context');
        if (steps[0]?.name === 'i18n') return { registerTranslations };
        return {};
      }),
    };

    const locals = new PluginGuestLocals(boot(), remote);

    locals.i18n.registerTranslations('bg', { order: { button: { placeOrder: 'Поръчай' } } });
    locals.i18n.registerTranslations('en', { order: { button: { placeOrder: 'Order' } } });

    expect(remote.ref).toHaveBeenCalledWith('context', [{ name: 'i18n' }]);
    expect(registerTranslations).toHaveBeenCalledWith('bg', { order: { button: { placeOrder: 'Поръчай' } } });
    expect(registerTranslations).toHaveBeenCalledWith('en', { order: { button: { placeOrder: 'Order' } } });
    expect(registerTranslations).toHaveBeenCalledTimes(2);

    // The local manager answers immediately — synchronous `t()` never depended on the forward.
    expect(locals.t('order.button.placeOrder', undefined, 'bg')).toBe('Поръчай');

    await locals.flush();
  });

  it('flush() waits for a slow forward before resolving', async () => {
    let resolveForward: () => void = () => undefined;
    const registerTranslations = vi.fn(
      () => new Promise<void>((resolve) => { resolveForward = resolve; }),
    );
    const remote: any = {
      ref: vi.fn((_root: string, steps: Array<{ name: string }>) => (steps[0]?.name === 'i18n' ? { registerTranslations } : {})),
    };

    const locals = new PluginGuestLocals(boot(), remote);
    locals.i18n.registerTranslations('bg', { order: { button: { placeOrder: 'Поръчай' } } });

    let flushed = false;
    const flushPromise = locals.flush().then(() => { flushed = true; });

    // Not yet — the forward has not settled.
    await Promise.resolve();
    expect(flushed).toBe(false);

    resolveForward();
    await flushPromise;
    expect(flushed).toBe(true);
  });

  it('flush() tolerates a rejected forward instead of throwing', async () => {
    const registerTranslations = vi.fn(async () => { throw new Error('peer unavailable'); });
    const remote: any = {
      ref: vi.fn((_root: string, steps: Array<{ name: string }>) => (steps[0]?.name === 'i18n' ? { registerTranslations } : {})),
    };

    const locals = new PluginGuestLocals(boot(), remote);
    locals.i18n.registerTranslations('bg', { order: { button: { placeOrder: 'Поръчай' } } });

    await expect(locals.flush()).resolves.toBeUndefined();
  });
});

describe('PluginGuestLocals site clock', () => {
  it("asks the HOST for the site's clock — the guest cannot read framework settings itself", async () => {
    const siteClock = vi.fn(async () => ({ timeZone: 'Europe/Sofia', hourCycle: 'h23' }));
    const remote: any = {
      ref: vi.fn((_root: string, steps: Array<{ name: string }>) => (steps[0]?.name === 'i18n' ? { siteClock, registerTranslations: vi.fn() } : {})),
    };

    const locals = new PluginGuestLocals(boot(), remote);

    expect(await locals.i18n.siteClock()).toEqual({ timeZone: 'Europe/Sofia', hourCycle: 'h23' });
    expect(siteClock).toHaveBeenCalledTimes(1);
  });
});
