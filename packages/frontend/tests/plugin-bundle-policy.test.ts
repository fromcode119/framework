import { describe, expect, it } from 'vitest';
import { PluginUsageTracker } from '@fromcode119/react/plugin-usage-tracker';
import { PluginBundlePolicy } from '@/lib/document/plugin-bundle-policy';

const plugin = (slug: string, loadStrategy?: string) => ({ slug, capabilities: ['frontend'], ui: { entry: 'bundle.js', frontendEntry: 'frontend.js', ...(loadStrategy ? { loadStrategy } : {}) } });

describe('PluginBundlePolicy', () => {
  it('skips only idle plugins with a server bundle that the render never used and the theme does not depend on', () => {
    const skip = PluginBundlePolicy.skippable({
      plugins: [plugin('cms'), plugin('ecommerce'), plugin('forms', 'idle'), plugin('mlm', 'idle'), plugin('privacy', 'idle'), plugin('analytics', 'idle'), plugin('search', 'idle')],
      usedPlugins: ['cms', 'privacy'],
      withServerBundle: ['cms', 'ecommerce', 'forms', 'mlm', 'privacy', 'search'],
      themeDependencies: ['forms'],
    });
    // eager (cms, ecommerce) never; used (privacy) never; theme dependency (forms) never; no server bundle (analytics) never.
    expect(skip).toEqual(['mlm', 'search']);
  });

  it('never skips a plugin that loads no storefront runtime of its own', () => {
    expect(PluginBundlePolicy.skippable({ plugins: [{ slug: 'x', ui: { loadStrategy: 'idle' } }], usedPlugins: [], withServerBundle: ['x'], themeDependencies: [] })).toEqual([]);
  });
});

describe('PluginUsageTracker', () => {
  it('records slugs, drains sorted, and resets', () => {
    PluginUsageTracker.reset();
    PluginUsageTracker.record('forms'); PluginUsageTracker.record('cms'); PluginUsageTracker.record(''); PluginUsageTracker.record('cms');
    expect(PluginUsageTracker.drain()).toEqual(['cms', 'forms']);
    expect(PluginUsageTracker.drain()).toEqual([]);
  });
});
