import { describe, expect, it } from 'vitest';
import { PluginHost } from '@core/plugin/host/plugin-host';

describe('PluginHost.pluginPath', () => {
  it('keeps everything from the plugin segment on, whatever Express stripped as a mount', () => {
    expect(PluginHost.pluginPath('alpha', '/api/v1/plugins/alpha/health')).toBe('/alpha/health');
    expect(PluginHost.pluginPath('alpha', '/api/v1/plugins/alpha/meta?x=1')).toBe('/alpha/meta?x=1');
    expect(PluginHost.pluginPath('alpha', '/api/v1/plugins/alpha')).toBe('/alpha/');
  });

  it('does not mistake a longer slug for a shorter one', () => {
    expect(PluginHost.pluginPath('alpha', '/api/v1/plugins/alpha-extra/x')).toBeNull();
    expect(PluginHost.pluginPath('delta', '/api/v1/plugins/delta-econt/x')).toBeNull();
  });
});
