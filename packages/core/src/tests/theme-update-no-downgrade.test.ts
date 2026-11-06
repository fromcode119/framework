import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeUpdateService } from '@core/theme/theme-update-service';
import { VersionComparisonService } from '@core/services/version-comparison-service';

/**
 * An older build left in the catalogue is not an update. A theme at 1.2.35 was told "Update v1.2.6"
 * because any DIFFERENT version counted and the catalogue's first row was taken.
 */
describe('ThemeUpdateService.checkForUpdates — only a strictly newer version', () => {
  const logger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } as never;
  afterEach(() => vi.restoreAllMocks());

  const check = async (installed: string, offers: string[]) => {
    const service = new ThemeUpdateService(new Map([['shop', { slug: 'shop', version: installed } as never]]), async () => ({}) as never, logger);
    vi.spyOn(service, 'getMarketplaceThemes').mockResolvedValue(offers.map((version) => ({ slug: 'shop', version, downloadUrl: `shop-${version}.zip` })) as never);
    return service.checkForUpdates('shop');
  };

  it('does not offer an older catalogue version', async () => {
    await expect(check('1.2.35', ['1.2.6'])).resolves.toEqual({ available: false, currentVersion: '1.2.35' });
  });

  it('does not offer the version already installed', async () => {
    await expect(check('1.2.35', ['1.2.35'])).resolves.toEqual({ available: false, currentVersion: '1.2.35' });
  });

  it('offers the NEWEST version, whatever order the catalogue lists them in', async () => {
    await expect(check('1.2.35', ['1.2.6', '1.2.40', '1.2.36'])).resolves.toMatchObject({ available: true, latestVersion: '1.2.40', updateUrl: 'shop-1.2.40.zip' });
  });
});

describe('VersionComparisonService.newest', () => {
  it('compares numerically, not as text', () => {
    expect(VersionComparisonService.newest([{ version: '1.2.6' }, { version: '1.2.35' }, { version: '1.2.10' }])?.version).toBe('1.2.35');
  });

  it('has no newest of nothing', () => {
    expect(VersionComparisonService.newest([])).toBeUndefined();
  });
});
