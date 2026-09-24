import { describe, expect, it } from 'vitest';
import { PluginUsageTracker } from '@fromcode119/react/plugin-usage-tracker';
import { PluginBundlePolicy } from '@/lib/document/plugin-bundle-policy';

const plugin = (slug: string, loadStrategy?: string) => ({ slug, capabilities: ['frontend'], ui: { entry: 'bundle.js', frontendEntry: 'frontend.js', ...(loadStrategy ? { loadStrategy } : {}) } });

describe('PluginBundlePolicy', () => {
  it('skips only idle plugins with a server bundle that the render never used and the theme does not depend on', () => {
    const skip = PluginBundlePolicy.skippable({
      plugins: [plugin('zeta'), plugin('beta'), plugin('theta', 'idle'), plugin('alpha', 'idle'), plugin('consent', 'idle'), plugin('tracker', 'idle'), plugin('finder', 'idle')],
      usedPlugins: ['zeta', 'consent'],
      withServerBundle: ['zeta', 'beta', 'theta', 'alpha', 'consent', 'finder'],
      themeDependencies: ['theta'],
    });
    // eager (zeta, beta) never; used (consent) never; theme dependency (theta) never; no server bundle (tracker) never.
    expect(skip).toEqual(['alpha', 'finder']);
  });

  it('skips nothing on a recipe page, whose design the server never rendered', () => {
    expect(PluginBundlePolicy.skippable({
      plugins: [plugin('alpha', 'idle'), plugin('finder', 'idle')],
      usedPlugins: [],
      withServerBundle: ['alpha', 'finder'],
      themeDependencies: [],
      rendersRecipe: true,
    })).toEqual([]);
  });

  it('never skips a plugin that loads no storefront runtime of its own', () => {
    expect(PluginBundlePolicy.skippable({ plugins: [{ slug: 'x', ui: { loadStrategy: 'idle' } }], usedPlugins: [], withServerBundle: ['x'], themeDependencies: [] })).toEqual([]);
  });
});

describe('PluginUsageTracker', () => {
  it('records slugs, drains sorted, and resets', () => {
    PluginUsageTracker.reset();
    PluginUsageTracker.record('theta'); PluginUsageTracker.record('zeta'); PluginUsageTracker.record(''); PluginUsageTracker.record('zeta');
    expect(PluginUsageTracker.drain()).toEqual(['theta', 'zeta']);
    expect(PluginUsageTracker.drain()).toEqual([]);
  });
});
