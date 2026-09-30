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

/**
 * A manifest is written by whoever uploaded the plugin. A platform plugin's `sandbox` is reviewed code
 * and may ask for more; a site's plugin could otherwise give itself any heap and no deadline at all.
 */
describe('the limits a manifest can set', () => {
  const settings = PluginIsolationSettings.defaults();
  const platform = { memoryMb: settings.memoryMb, timeoutMs: settings.timeoutMs };

  it('are whatever a platform plugin asks for', () => {
    expect(settings.forPlugin({ memoryLimit: 4096, timeout: 600_000 })).toEqual({ memoryMb: 4096, timeoutMs: 600_000 });
  });

  it('can only be LOWER than the platform limits for a plugin a site uploaded', () => {
    expect(settings.forPlugin({ memoryLimit: 4096, timeout: 600_000 }, true)).toEqual(platform);
    expect(settings.forPlugin({ memoryLimit: 128, timeout: 5_000 }, true)).toEqual({ memoryMb: 128, timeoutMs: 5_000 });
    expect(settings.forPlugin(undefined, true)).toEqual(platform);
  });

  it('come with a declared share of the machine for a site plugin, from the platform settings', async () => {
    const rows: Record<string, string> = { plugin_isolation_site_cpu_percent: '30', plugin_isolation_site_memory_mb: '200' };
    const read = await PluginIsolationSettings.read({ findOne: async (_table, where) => (rows[String(where.key)] ? { value: rows[String(where.key)] } : null) });
    expect(read.siteResourceLimits()).toEqual({ cpuPercent: 30, memoryMb: 200 });
    expect(PluginIsolationSettings.defaults().siteResourceLimits()).toEqual({ cpuPercent: 50, memoryMb: 384 });
  });
});
