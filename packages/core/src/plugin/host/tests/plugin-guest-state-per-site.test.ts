import { describe, expect, it } from 'vitest';
import { PluginGuestState } from '@core/plugin/host/plugin-guest-state';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

/**
 * Measured on production (0.2.274): about 1 in 180 storefront product requests failed with "Missing
 * required dependency: org.fromcode:ledger" on a site that runs it. The guest held ONE peer
 * snapshot, replaced by every envelope — a request of a site without the ledger, overlapping, replaced it.
 */
describe('PluginGuestState, one snapshot per site', () => {
  const asSite = <T>(tenantId: string | null, fn: () => T): T => PluginGuestRemote.invocation.run({ token: 't', tenantId } as any, fn);

  it("a site keeps its peers while another site's envelope arrives in between", async () => {
    const state = new PluginGuestState();
    state.update({ tenantId: 'shop-site', peers: { 'org.fromcode:ledger': ['priceLines'] }, enabledPlugins: ['ledger', 'shop'] });
    // The overlapping request of a site without the ledger.
    state.update({ tenantId: 'blog-site', peers: {}, enabledPlugins: ['pages'] });

    expect(asSite('shop-site', () => state.hasPeer('org.fromcode', 'ledger'))).toBe(true);
    expect(asSite('shop-site', () => state.isEnabled('ledger'))).toBe(true);
    expect(asSite('blog-site', () => state.hasPeer('org.fromcode', 'ledger'))).toBe(false);
    expect(asSite('blog-site', () => state.isEnabled('pages'))).toBe(true);
  });

  it('answers interleaved concurrent work of two sites each with its own snapshot', async () => {
    const state = new PluginGuestState();
    const answers: string[] = [];
    const work = (site: string, delay: number) => asSite(site, async () => {
      state.update({ tenantId: site, peers: site === 'shop-site' ? { 'org.fromcode:ledger': [] } : {}, enabledPlugins: [] });
      await new Promise((resolve) => setTimeout(resolve, delay));
      answers.push(`${site}:${state.hasPeer('org.fromcode', 'ledger')}`);
    });
    await Promise.all([work('shop-site', 20), work('blog-site', 5)]);
    expect(answers.sort()).toEqual(['blog-site:false', 'shop-site:true']);
  });

  it('an envelope without a site (platform work, an older api) is the fallback for a site not yet seen', () => {
    const state = new PluginGuestState();
    state.update({ peers: { 'org.fromcode:ledger': [] }, enabledPlugins: [] } as any);
    expect(asSite('new-site', () => state.hasPeer('org.fromcode', 'ledger'))).toBe(true);
    expect(state.hasPeer('org.fromcode', 'ledger')).toBe(true);
  });
});
