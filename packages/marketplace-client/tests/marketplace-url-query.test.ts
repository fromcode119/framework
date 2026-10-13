import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceClient } from '@marketplace-client/marketplace-client';
import { MarketplaceUrlService } from '@marketplace-client/marketplace-url-service';

/**
 * A marketplace that admits only the installations it knows identifies them by a `key` on its address
 * (`https://market.example/?key=…`). The address keeps it; requests never put it in the URL — it travels
 * in a header, to the marketplace's own host only — and log lines never show it.
 */
describe('a marketplace address with a key', () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it('requests the catalogue with the key in a header, not in the URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ plugins: [], themes: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new MarketplaceClient('https://market.example?key=abc&channel=beta').fetch();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://market.example/api/v1/plugins/marketplace/marketplace.json?channel=beta');
    expect(init.headers).toEqual({ 'X-Marketplace-Key': 'abc' });
  });

  it('resolves a relative download without the key and gives its headers separately', () => {
    const client = new MarketplaceClient('https://market.example?key=abc&channel=beta');
    const url = client.resolveDownloadUrl('download/shop');
    expect(url).toBe('https://market.example/api/v1/plugins/marketplace/download/shop?channel=beta');
    expect(client.requestHeaders(url)).toEqual({ 'X-Marketplace-Key': 'abc' });
  });

  it('keeps a same-host download\'s own parameters', () => {
    const client = new MarketplaceClient('https://market.example?key=abc');
    expect(client.resolveDownloadUrl('https://market.example/files/shop.zip?v=2'))
      .toBe('https://market.example/files/shop.zip?v=2');
  });

  it('never hands the key to another host', () => {
    const client = new MarketplaceClient('https://market.example?key=abc&channel=beta');
    const url = client.resolveDownloadUrl('https://files.elsewhere.example/shop.zip');
    expect(url).toBe('https://files.elsewhere.example/shop.zip');
    expect(client.requestHeaders(url)).toEqual({});
  });

  it('sends no header when the address has no key', () => {
    const client = new MarketplaceClient('https://market.example');
    expect(client.requestHeaders(client.resolveDownloadUrl('download/shop'))).toEqual({});
  });

  it('masks query values for logs', () => {
    expect(MarketplaceUrlService.redact('https://market.example/api/v1/plugins/marketplace/download/shop?key=abc'))
      .toBe('https://market.example/api/v1/plugins/marketplace/download/shop?key=***');
    expect(MarketplaceUrlService.redact('https://market.example/x')).toBe('https://market.example/x');
  });
});
