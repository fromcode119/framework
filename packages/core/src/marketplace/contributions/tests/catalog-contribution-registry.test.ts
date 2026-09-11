import { describe, expect, it } from 'vitest';
import { CatalogContributionRegistry } from '@core/marketplace/contributions/catalog-contribution-registry';

describe('CatalogContributionRegistry.resolveArtifact', () => {
  const contributor = (over: Record<string, unknown>) => ({
    namespace: 'org.fromcode',
    pluginSlug: 'sources',
    list: async () => [],
    ...over,
  });

  it('returns the path the contributor reports', async () => {
    const registry = new CatalogContributionRegistry();
    registry.register(contributor({ resolveArtifact: async () => '/app/data/sources/themes/fromcode-0.1.29.zip' }));

    expect(await registry.resolveArtifact('fromcode', 'theme'))
      .toBe('/app/data/sources/themes/fromcode-0.1.29.zip');
  });

  it('is null when the only contributor hosts nothing, so the caller never invents a location', async () => {
    const registry = new CatalogContributionRegistry();
    registry.register(contributor({ resolveArtifact: async () => null }));

    expect(await registry.resolveArtifact('fromcode', 'theme')).toBeNull();
  });

  it('is null for a contributor that cannot resolve at all', async () => {
    const registry = new CatalogContributionRegistry();
    registry.register(contributor({}));

    expect(await registry.resolveArtifact('fromcode', 'theme')).toBeNull();
  });

  it('keeps asking after one contributor throws', async () => {
    const registry = new CatalogContributionRegistry();
    registry.register(contributor({
      pluginSlug: 'broken',
      resolveArtifact: async () => { throw new Error('workspace unreadable'); },
    }));
    registry.register(contributor({ resolveArtifact: async () => '/app/data/sources/themes/fromcode-0.1.29.zip' }));

    expect(await registry.resolveArtifact('fromcode', 'theme'))
      .toBe('/app/data/sources/themes/fromcode-0.1.29.zip');
  });

  it('refuses a blank slug without asking anyone', async () => {
    const registry = new CatalogContributionRegistry();
    let asked = false;
    registry.register(contributor({ resolveArtifact: async () => { asked = true; return '/x.zip'; } }));

    expect(await registry.resolveArtifact('   ', 'theme')).toBeNull();
    expect(asked).toBe(false);
  });
});
