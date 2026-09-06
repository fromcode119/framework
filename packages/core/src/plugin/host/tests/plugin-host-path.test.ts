import { describe, expect, it } from 'vitest';
import { PluginHost } from '@core/plugin/host/plugin-host';

describe('PluginHost.pluginPath', () => {
  it('keeps everything from the plugin segment on, whatever Express stripped as a mount', () => {
    expect(PluginHost.pluginPath('seo', '/api/v1/plugins/seo/health')).toBe('/seo/health');
    expect(PluginHost.pluginPath('seo', '/api/v1/plugins/seo/meta?x=1')).toBe('/seo/meta?x=1');
    expect(PluginHost.pluginPath('seo', '/api/v1/plugins/seo')).toBe('/seo/');
  });

  it('does not mistake a longer slug for a shorter one', () => {
    expect(PluginHost.pluginPath('seo', '/api/v1/plugins/seo-extra/x')).toBeNull();
    expect(PluginHost.pluginPath('logistics', '/api/v1/plugins/logistics-econt/x')).toBeNull();
  });
});
