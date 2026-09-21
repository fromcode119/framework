import { describe, expect, it } from 'vitest';
import { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import { PluginBundlePolicy } from '@/lib/document/plugin-bundle-policy';

// Same shape plugin-bundle-policy.test.ts uses: a plugin only counts if it loads its own storefront runtime.
const idlePlugin = (slug: string) => ({ slug, capabilities: ['frontend'], ui: { entry: 'bundle.js', frontendEntry: 'frontend.js', loadStrategy: 'idle' } });

describe('usedPlugins reaches the runtime', () => {
  it('round-trips the plugins the server render mounted', () => {
    const config = FrontendRuntimeConfig.fromJson({ usedPlugins: ['social-proof', 'cms'], skipPlugins: ['mlm'] });
    expect(config.usedPlugins).toEqual(['social-proof', 'cms']);
    expect(config.skipPlugins).toEqual(['mlm']);
  });

  it('reads an absent list as empty rather than throwing', () => {
    expect(FrontendRuntimeConfig.fromJson({}).usedPlugins).toEqual([]);
    expect(FrontendRuntimeConfig.fromJson({ usedPlugins: 'nope' }).usedPlugins).toEqual([]);
  });
});

describe('a plugin the server mounted is not skippable — and must not wait for idle', () => {
  it('skips an idle plugin the render did NOT mount', () => {
    expect(PluginBundlePolicy.skippable({
      plugins: [idlePlugin('mlm')],
      usedPlugins: [],
      withServerBundle: ['mlm'],
      themeDependencies: [],
    })).toEqual(['mlm']);
  });

  it('does NOT skip one the render DID mount', () => {
    // social-proof on the home page: its section is in the server markup, so its bundle is needed —
    // and, because that markup is being hydrated, it is needed BEFORE hydration, not on browser idle.
    expect(PluginBundlePolicy.skippable({
      plugins: [idlePlugin('social-proof')],
      usedPlugins: ['social-proof'],
      withServerBundle: ['social-proof'],
      themeDependencies: [],
    })).toEqual([]);
  });
});
