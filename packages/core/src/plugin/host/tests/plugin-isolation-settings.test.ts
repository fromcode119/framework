import { describe, expect, it } from 'vitest';
import { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';

/**
 * Where a plugin runs is not a setting any more. Inside the api a plugin holds the api — every secret,
 * every site's data — so "shared" made one bad plugin a platform compromise. Only the framework's own
 * bundled extensions keep what their manifest states.
 */
describe('whether a plugin runs in its own process', () => {
  const settings = PluginIsolationSettings.defaults();

  it('always, for any plugin that is not the framework\'s own — whatever its manifest or saved row asks', () => {
    for (const sandbox of [false, { enabled: false }, { enabled: true }, {}, undefined, null]) {
      expect(settings.isIsolated(sandbox)).toBe(true);
    }
  });

  it('as its manifest states, for a bundled extension', () => {
    expect(settings.isIsolated(false, true)).toBe(false);
    expect(settings.isIsolated({ enabled: false }, true)).toBe(false);
    expect(settings.isIsolated({}, true)).toBe(true);
  });
});
