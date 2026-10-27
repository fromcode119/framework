import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';

/**
 * The LCP preload must name the exact URL the page then requests, or the browser fetches the image twice.
 * `{api}` is the api prefix the deployment serves, so a theme never writes the api path into its manifest.
 */
describe('theme LCP url template', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  const entry: any = { key: 'products', lcp: { imagePath: 'items.0.imageUrl', urlTemplate: '{api}/plugins/cms/img?src={value}&w={width}&q=60', widths: [360, 800] } };
  const data = { products: { items: [{ imageUrl: '/uploads/hero.webp' }] } };

  it('fills {api} with the served prefix', () => {
    const preload = ThemeDataPrefetcher.extractLcpImageUrl(data, [entry], 'https://shop.example');
    expect(preload?.href).toBe('https://shop.example/api/plugins/cms/img?src=%2Fuploads%2Fhero.webp&w=800&q=60');
    expect(preload?.imageSrcSet).toContain('https://shop.example/api/plugins/cms/img?src=%2Fuploads%2Fhero.webp&w=360&q=60 360w');
  });

  it('never adds a version segment', () => {
    vi.stubEnv('API_VERSION_PREFIX', 'v2');
    expect(ThemeDataPrefetcher.extractLcpImageUrl(data, [entry], '')?.href).toBe('/api/plugins/cms/img?src=%2Fuploads%2Fhero.webp&w=800&q=60');
  });
});
