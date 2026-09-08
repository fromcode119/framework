import { describe, expect, it } from 'vitest';
import { PluginUsageTracker } from '@fromcode119/react/plugin-usage-tracker';
import { PluginBundlePolicy } from '@/lib/document/plugin-bundle-policy';

const plugin = (slug: string, loadStrategy?: string) => ({ slug, capabilities: ['frontend'], ui: { entry: 'bundle.js', frontendEntry: 'frontend.js', ...(loadStrategy ? { loadStrategy } : {}) } });

describe('PluginBundlePolicy', () => {
  it('skips only idle plugins with a server bundle that the render never used and the theme does not depend on', () => {
    const skip = PluginBundlePolicy.skippable({
      plugins: [plugin('zeta'), plugin('beta'), plugin('theta', 'idle'), plugin('alpha', 'idle'), plugin('privacy', 'idle'), plugin('analytics', 'idle'), plugin('search', 'idle')],
      usedPlugins: ['zeta', 'privacy'],
      withServerBundle: ['zeta', 'beta', 'theta', 'alpha', 'privacy', 'search'],
      themeDependencies: ['theta'],
    });
    // eager (zeta, beta) never; used (privacy) never; theme dependency (forms) never; no server bundle (analytics) never.
    expect(skip).toEqual(['alpha', 'search']);
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
