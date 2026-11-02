import { describe, expect, it } from 'vitest';
import { MarketplaceUrlService } from '@marketplace-client/marketplace-url-service';

/** The usage report goes to the marketplace's own API, never with the address's key. */
describe('MarketplaceUrlService.resolveUsageReportUrl', () => {
  it('derives the report URL from a bare address, the way the catalogue URL is derived', () => {
    expect(MarketplaceUrlService.resolveUsageReportUrl('https://market.example'))
      .toBe('https://market.example/api/plugins/marketplace/webhooks/usage');
    expect(MarketplaceUrlService.resolveUsageReportUrl('https://market.example/'))
      .toBe('https://market.example/api/plugins/marketplace/webhooks/usage');
  });

  it('drops the key, so a report cannot be tied to a client', () => {
    expect(MarketplaceUrlService.resolveUsageReportUrl('https://market.example/?key=abc'))
      .toBe('https://market.example/api/plugins/marketplace/webhooks/usage');
  });

  it('refuses an address that is not http(s)', () => {
    expect(MarketplaceUrlService.resolveUsageReportUrl('ftp://market.example')).toBe('');
    expect(MarketplaceUrlService.resolveUsageReportUrl('')).toBe('');
  });
});
