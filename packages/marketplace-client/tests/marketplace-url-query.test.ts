import { describe, expect, it } from 'vitest';
import { MarketplaceClient } from '@marketplace-client/marketplace-client';
import { MarketplaceUrlService } from '@marketplace-client/marketplace-url-service';

/**
 * A marketplace that admits only the installations it knows identifies them by a query on its
 * address (`?key=…`). The query belongs to the address: it must reach the catalogue and every download
 * from the same host, never a download on another host, and never a log line.
 */
describe('a marketplace address with a query', () => {
  it('keeps the query on the catalogue address, whatever form the address was typed in', () => {
    expect(MarketplaceUrlService.resolveCatalogUrl('https://market.example?key=abc'))
      .toBe('https://market.example/api/v1/plugins/marketplace/marketplace.json?key=abc');
    expect(MarketplaceUrlService.resolveCatalogUrl('https://market.example/?key=abc'))
      .toBe('https://market.example/api/v1/plugins/marketplace/marketplace.json?key=abc');
    expect(MarketplaceUrlService.resolveCatalogUrl('https://market.example/api/v1/plugins/marketplace/marketplace.json?key=abc'))
      .toBe('https://market.example/api/v1/plugins/marketplace/marketplace.json?key=abc');
  });

  it('resolves to the same address when resolved twice', () => {
    const once = MarketplaceUrlService.resolveCatalogUrl('https://market.example?key=abc');
    expect(MarketplaceUrlService.resolveCatalogUrl(once)).toBe(once);
  });

  it('leaves an address without a query exactly as before', () => {
    expect(MarketplaceUrlService.resolveCatalogUrl('https://market.example'))
      .toBe('https://market.example/api/v1/plugins/marketplace/marketplace.json');
    expect(MarketplaceUrlService.resolveApiBaseUrl('https://market.example/'))
      .toBe('https://market.example/api/v1/plugins/marketplace');
  });

  it('works out the api base without the query', () => {
    expect(MarketplaceUrlService.resolveApiBaseUrl('https://market.example?key=abc'))
      .toBe('https://market.example/api/v1/plugins/marketplace');
  });

  it('carries the query onto a relative download', () => {
    const client = new MarketplaceClient('https://market.example?key=abc');
    expect(client.resolveDownloadUrl('download/shop'))
      .toBe('https://market.example/api/v1/plugins/marketplace/download/shop?key=abc');
  });

  it('carries the query onto an absolute download on the same host, keeping its own parameters', () => {
    const client = new MarketplaceClient('https://market.example?key=abc');
    expect(client.resolveDownloadUrl('https://market.example/files/shop.zip?v=2'))
      .toBe('https://market.example/files/shop.zip?v=2&key=abc');
    expect(client.resolveDownloadUrl('https://market.example/files/shop.zip?key=other'))
      .toBe('https://market.example/files/shop.zip?key=other');
  });

  it('never hands the query to another host', () => {
    const client = new MarketplaceClient('https://market.example?key=abc');
    expect(client.resolveDownloadUrl('https://files.elsewhere.example/shop.zip'))
      .toBe('https://files.elsewhere.example/shop.zip');
  });

  it('masks query values for logs', () => {
    expect(MarketplaceUrlService.redact('https://market.example/api/v1/plugins/marketplace/download/shop?key=abc'))
      .toBe('https://market.example/api/v1/plugins/marketplace/download/shop?key=***');
    expect(MarketplaceUrlService.redact('https://market.example/x')).toBe('https://market.example/x');
  });
});
