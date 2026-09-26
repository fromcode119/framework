import { describe, expect, it } from 'vitest';
import { PluginSiteDataContext } from '@core/plugin/tenant/plugin-site-data-context';

/** The host asks this to tell an isolated plugin's process that a registration was a replay's, not real. */
describe('PluginSiteDataContext.isSiteDataPass', () => {
  it('knows its own per-site passes and nothing else', () => {
    const real: any = { api: { get: () => undefined }, hooks: { on: () => undefined } };
    const pass = PluginSiteDataContext.wrap(real);
    expect(PluginSiteDataContext.isSiteDataPass(pass)).toBe(true);
    expect(PluginSiteDataContext.isSiteDataPass(real)).toBe(false);
    expect(PluginSiteDataContext.isSiteDataPass(null)).toBe(false);
  });
});
