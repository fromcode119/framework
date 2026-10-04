import { describe, expect, it } from 'vitest';
import { MarketplaceOfferMatch } from '@core/marketplace/marketplace-offer-match';

describe('MarketplaceOfferMatch.assert', () => {
  it('accepts the package the catalogue offered', () => {
    expect(() => MarketplaceOfferMatch.assert('plugin', { slug: 'demo', version: '1.0.1' }, { slug: 'demo', version: '1.0.1' })).not.toThrow();
  });

  it('refuses a package of another version than the one offered', () => {
    expect(() => MarketplaceOfferMatch.assert('plugin', { slug: 'demo', version: '1.0.1' }, { slug: 'demo', version: '1.0.0' }))
      .toThrow(/"demo" 1\.0\.0, but the marketplace offered "demo" 1\.0\.1/);
  });

  it('refuses a package that is another extension altogether', () => {
    expect(() => MarketplaceOfferMatch.assert('theme', { slug: 'aurora', version: '2.0.0' }, { slug: 'nebula', version: '2.0.0' }))
      .toThrow(/theme package is "nebula"/);
  });

  it('holds only the slug when the offer names no version', () => {
    expect(() => MarketplaceOfferMatch.assert('appearance', { slug: 'hub' }, { slug: 'hub', version: '0.3.0' })).not.toThrow();
  });
});
