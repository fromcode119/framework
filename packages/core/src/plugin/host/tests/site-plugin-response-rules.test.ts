import { afterEach, describe, expect, it } from 'vitest';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';
import { SitePluginResponseRules } from '@core/plugin/host/site-plugin-response-rules';

describe('what a site plugin may answer', () => {
  afterEach(() => PluginOwners.forget('box'));

  it('shows a page only inside a frame — never as a page someone navigates to', () => {
    for (const type of ['text/html; charset=utf-8', 'application/xhtml+xml', 'image/svg+xml', 'text/xml', 'application/xml', '']) {
      expect(SitePluginResponseRules.refusesDocument(200, type, 'document')).toBe(true);
      expect(SitePluginResponseRules.refusesDocument(404, type, undefined)).toBe(true);
      expect(SitePluginResponseRules.refusesDocument(200, type, 'iframe')).toBe(false);
    }
  });

  it('leaves data, and replies with nothing to render, alone', () => {
    expect(SitePluginResponseRules.refusesDocument(200, 'application/json', 'document')).toBe(false);
    expect(SitePluginResponseRules.refusesDocument(200, 'image/png', 'document')).toBe(false);
    for (const status of [204, 301, 302, 304]) expect(SitePluginResponseRules.refusesDocument(status, '', 'document')).toBe(false);
  });

  it('names a site plugin\'s own route, and nothing else', () => {
    PluginOwners.record('box', 'site-a');
    expect(SitePluginResponseRules.sitePluginOf('/api/v1/plugins/box/widget?x=1')).toBe('box');
    expect(SitePluginResponseRules.sitePluginOf('/api/v1/plugins/platform-one/x')).toBeNull();
    expect(SitePluginResponseRules.sitePluginOf('/api/v1/auth/login')).toBeNull();
    expect(SitePluginResponseRules.sitePluginOf('/api/v1/auth/login?next=/api/v1/plugins/box/')).toBeNull();
  });
});
