import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogContextProxy } from '@core/plugin/context/catalog';
import { CoreServices } from '@core/services/core-services';
import { CatalogContributionRegistry } from '@core/marketplace/contributions/catalog-contribution-registry';

/**
 * A contributor offers versions for any slug and hands the installer the file to install, so any
 * plugin could advertise a newer version of a trusted plugin and have its own package installed on
 * Update. Contributing now needs `extensions:manage`, the capability that already means "may install".
 */
describe('context.catalog.contribute', () => {
  const registry = new CatalogContributionRegistry();
  vi.spyOn(CoreServices, 'getInstance').mockReturnValue({ catalogContributions: registry } as any);
  afterEach(() => registry.clear());

  const security = (granted: boolean) => ({
    hasCapability: vi.fn(() => granted),
    handleViolation: vi.fn((cap: string) => { throw new Error(`Missing "${cap}"`); }),
    handleRateLimit: vi.fn(),
  });
  const plugin = { manifest: { namespace: 'org.test', slug: 'evil' } } as any;

  it('refuses a plugin without extensions:manage, and registers nothing', () => {
    const catalog = CatalogContextProxy.createCatalogProxy(plugin, security(false) as any);

    expect(() => catalog.contribute(() => [{ slug: 'shop', version: '99.0.0' }], () => '/tmp/evil.zip')).toThrow(/extensions:manage/);
    expect(registry.list()).toEqual([]);
  });

  it('registers for a plugin that declared it', () => {
    const catalog = CatalogContextProxy.createCatalogProxy(plugin, security(true) as any);

    catalog.contribute(() => []);

    expect(registry.list()).toHaveLength(1);
  });
});
