import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextBridge } from '@fromcode119/react/context-bridge';
import { ThemeOverrideRegistrar } from '@fromcode119/react/theme-override-registrar';
import { OverrideLoaderWarmup } from '@/runtime/override-loader-warmup';

const Renderer = () => null;

describe('ThemeOverrideRegistrar cached loaders + OverrideLoaderWarmup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a registered loader resolves asynchronously first, then SYNCHRONOUSLY once its module is cached', async () => {
    const captured: Array<() => Promise<{ default: unknown }>> = [];
    vi.spyOn(ContextBridge, 'registerOverride').mockImplementation((...args: any[]) => { captured.push(args[4]); return undefined; });
    ThemeOverrideRegistrar.registerThemeBlockRenderers('demo', { './blocks/hero.tsx': () => Promise.resolve({ HeroRenderer: Renderer }) }, 'zeta.block.');
    expect(captured).toHaveLength(1);
    const loader = captured[0];
    let syncValue: unknown = null;
    loader().then((v) => { syncValue = v; });
    expect(syncValue).toBeNull(); // first call: a real promise, settles later
    await Promise.resolve(); await Promise.resolve();
    expect((syncValue as { default: unknown }).default).toBe(Renderer);
    syncValue = null;
    loader().then((v) => { syncValue = v; });
    expect((syncValue as { default: unknown } | null)?.default).toBe(Renderer); // cached: settled in the same tick
  });

  it('warms every override loader and reports how many settled, bounded by the cap', async () => {
    const fast = vi.fn(() => Promise.resolve({ default: Renderer }));
    const never = vi.fn(() => new Promise<{ default: any }>(() => undefined));
    const overrides = {
      a: { component: Renderer, pluginSlug: 't', priority: 1, loader: fast },
      b: { component: Renderer, pluginSlug: 't', priority: 1 },
      c: { component: Renderer, pluginSlug: 't', priority: 1, loader: never },
    };
    const settled = await OverrideLoaderWarmup.warm(overrides as any, 20);
    expect(fast).toHaveBeenCalledTimes(1);
    expect(never).toHaveBeenCalledTimes(1);
    expect(settled).toBe(1);
  });
});
