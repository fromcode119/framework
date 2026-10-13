import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreServices } from '@core/services/core-services';
import { MarketplaceCatalogService } from '@core/marketplace/marketplace-catalog-service';

/**
 * The plugin catalogue merges what this installation built, by slug. The contributions registry also
 * carries themes and appearances, so a theme named like a plugin replaced the plugin's offer: the
 * plugin's new version never showed as an update, and an install could have fetched the theme's package.
 */
describe('MarketplaceCatalogService — what the plugins catalogue offers', () => {
  const withContributions = (rows: Array<Record<string, unknown>>) => {
    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      catalogContributions: { list: () => [{ canonicalKey: 'org.fromcode:sources', list: async () => rows }] },
    } as never);
  };

  const service = () => {
    const catalogue = new MarketplaceCatalogService({} as never);
    vi.spyOn(catalogue as any, 'ensureClient').mockResolvedValue({ client: null, url: null });
    return catalogue;
  };

  afterEach(() => vi.restoreAllMocks());

  it('offers a plugin that shares its slug with a theme, and never the theme', async () => {
    withContributions([
      { slug: 'marketplace', version: '0.3.0', kind: 'plugin' },
      { slug: 'marketplace', version: '0.1.1', kind: 'theme' },
    ]);

    const plugins = await service().fetchCatalog();

    expect(plugins.map((p: any) => [p.slug, p.version, p.kind])).toEqual([['marketplace', '0.3.0', 'plugin']]);
  });

  it('ignores contributed themes and appearances', async () => {
    withContributions([
      { slug: 'shop', version: '1.0.0' },
      { slug: 'aurora', version: '0.1.29', kind: 'theme' },
      { slug: 'hub', version: '0.1.1', kind: 'appearance' },
    ]);

    const plugins = await service().fetchCatalog();

    expect(plugins.map((p: any) => p.slug)).toEqual(['shop']);
  });
});
