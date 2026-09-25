import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeManager } from '@core/theme/theme-manager';
import { AppearanceManager } from '@core/appearance/appearance-manager';
import { SiteMarketplaceUrl } from '@core/marketplace/site-marketplace-url';
import { PlatformSettingsService } from '@core/management/platform-settings-service';

/**
 * The theme screens built their marketplace client from the environment, once, in the ThemeManager
 * constructor — the Marketplace URL saved in the admin never reached them at all. The appearance
 * screens read the setting, but memoised the client for the life of the process.
 */
describe('a saved Marketplace URL reaches the theme and appearance screens', () => {
  afterEach(() => {
    SiteMarketplaceUrl.reset();
    vi.restoreAllMocks();
  });

  it('themes read the catalogue the admin saved, on the next call', async () => {
    let saved = 'https://one.example/marketplace.json';
    SiteMarketplaceUrl.registerAccessor(async () => [{ tenantId: null, value: saved }]);

    const first = await (ThemeManager as any).marketplaceClient();
    saved = 'https://two.example/marketplace.json';
    const second = await (ThemeManager as any).marketplaceClient();

    expect((first as any).marketplaceUrl).toContain('one.example');
    expect((second as any).marketplaceUrl).toContain('two.example');
  });

  it('appearances follow a saved change, including turning the marketplace off', async () => {
    const resolve = vi.spyOn(PlatformSettingsService, 'resolve').mockResolvedValue('https://one.example/marketplace.json');
    const manager = new AppearanceManager({ info() {}, warn() {}, error() {}, debug() {} } as any, '/tmp/none');

    expect(await (manager as any).resolveClient()).not.toBeNull();
    resolve.mockResolvedValue('off');
    expect(await (manager as any).resolveClient()).toBeNull();
  });
});
