import { describe, expect, it } from 'vitest';
import { AccountSectionRegistry } from '@fromcode119/react/account/account-section-registry';
import { PluginUsageTracker } from '@fromcode119/react/plugin-usage-tracker';

/**
 * Account panels are read from their slot directly, so listing them is what marks their plugins as used
 * by the page — otherwise the browser defers those bundles past hydration and lists fewer sections.
 */
describe('AccountSectionRegistry.buildAll usage', () => {
  it('reports every plugin whose panel it lists, and not the framework', () => {
    class Panel { static accountSection = { key: 'planned-work', priority: 50 }; }
    PluginUsageTracker.reset();
    AccountSectionRegistry.buildAll([{ component: Panel, pluginSlug: 'scheduling' } as never]);
    expect(PluginUsageTracker.drain()).toEqual(['scheduling']);
  });
});
