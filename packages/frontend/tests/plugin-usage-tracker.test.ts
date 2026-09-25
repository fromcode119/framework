import { describe, expect, it } from 'vitest';
import { PluginUsageTracker } from '@fromcode119/react/plugin-usage-tracker';


describe('PluginUsageTracker', () => {
  it('records slugs, drains sorted, and resets', () => {
    PluginUsageTracker.reset();
    PluginUsageTracker.record('theta'); PluginUsageTracker.record('zeta'); PluginUsageTracker.record(''); PluginUsageTracker.record('zeta');
    expect(PluginUsageTracker.drain()).toEqual(['theta', 'zeta']);
    expect(PluginUsageTracker.drain()).toEqual([]);
  });
});
