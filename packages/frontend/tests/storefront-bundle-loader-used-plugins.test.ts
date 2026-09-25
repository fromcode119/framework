import { describe, expect, it } from 'vitest';
import { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';

// Same shape plugin-bundle-policy.test.ts uses: a plugin only counts if it loads its own storefront runtime.
const idlePlugin = (slug: string) => ({ slug, capabilities: ['frontend'], ui: { entry: 'bundle.js', frontendEntry: 'frontend.js', loadStrategy: 'idle' } });

describe('usedPlugins reaches the runtime', () => {
  it('round-trips the plugins the server render mounted', () => {
    const config = FrontendRuntimeConfig.fromJson({ usedPlugins: ['reviews', 'gallery'] });
    expect(config.usedPlugins).toEqual(['reviews', 'gallery']);
  });

  it('reads an absent list as empty rather than throwing', () => {
    expect(FrontendRuntimeConfig.fromJson({}).usedPlugins).toEqual([]);
    expect(FrontendRuntimeConfig.fromJson({ usedPlugins: 'nope' }).usedPlugins).toEqual([]);
  });
});


describe('every plugin bundle loads — none is skipped', () => {
  it('loads an idle plugin the server render never mounted', async () => {
    // A booking calendar lives in a checkout drawer the server never renders; skipping the idle
    // plugin that owns it left the drawer with no calendar on production.
    const { PluginLoaderMountService } = await import('@/app/plugin-loader-mount-service');
    const loaded: string[] = [];
    const idle = (globalThis as any).requestIdleCallback;
    (globalThis as any).requestIdleCallback = (fn: () => void) => { fn(); return 0; };
    try {
      PluginLoaderMountService.loadPluginRuntimes([idlePlugin('appointments')], 'http://api.test', async (key) => { loaded.push(key); });
    } finally {
      (globalThis as any).requestIdleCallback = idle;
    }
    expect(loaded.join(' ')).toContain('appointments');
  });
});
