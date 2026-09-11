import { describe, it, expect } from 'vitest';
import { CatalogContributionRegistry } from '@core/marketplace/contributions/catalog-contribution-registry';
import { CatalogEntry } from '@core/marketplace/contributions/catalog-entry';

describe('CatalogContributionRegistry', () => {
  const contributor = (over: Record<string, unknown> = {}): any => ({
    namespace: 'org.fromcode',
    pluginSlug: 'build-server',
    list: () => [],
    ...over,
  });

  /** A plugin re-init must replace its registration, never stack a second copy of it. */
  it('registers one contributor per plugin, replacing on re-registration', () => {
    const registry = new CatalogContributionRegistry();
    registry.register(contributor());
    registry.register(contributor());
    expect(registry.list()).toHaveLength(1);
  });

  it('refuses a registration with nothing to call', () => {
    const registry = new CatalogContributionRegistry();
    registry.register(contributor({ list: undefined }));
    expect(registry.list()).toEqual([]);
  });

  it('removes a plugin’s registration when it unregisters', () => {
    const registry = new CatalogContributionRegistry();
    registry.register(contributor());
    registry.unregisterByPlugin('org.fromcode', 'build-server');
    expect(registry.list()).toEqual([]);
  });
});

describe('CatalogEntry', () => {
  it('rejects a row with no slug or no version — neither can be compared against what is installed', () => {
    expect(CatalogEntry.from({ slug: '', version: '1.0.0' })).toBeNull();
    expect(CatalogEntry.from({ slug: 'forms', version: '' })).toBeNull();
  });

  /** Contributed entries must be indistinguishable downstream, or the badge and action break. */
  it('speaks the catalogue’s own shape', () => {
    const entry = CatalogEntry.from({ slug: 'forms', version: '1.2.0', kind: 'plugin', notes: 'Fixed a thing' });
    expect(entry?.toCatalogPlugin()).toMatchObject({
      slug: 'forms',
      version: '1.2.0',
      releaseNotes: 'Fixed a thing',
      source: 'local',
    });
  });

  it('defaults an unstated kind to plugin rather than dropping the entry', () => {
    expect(CatalogEntry.from({ slug: 'forms', version: '1.0.0' })?.kind).toBe('plugin');
  });
});
