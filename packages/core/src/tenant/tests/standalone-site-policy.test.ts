import { afterEach, describe, expect, it, vi } from 'vitest';
import { StandaloneSitePolicy } from '@core/tenant/standalone-site-policy';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * A single-site deployment's environment and indexability, read from Settings → General → Site
 * because there is no site row to carry them.
 */
describe('StandaloneSitePolicy', () => {
  const givenSettings = (values: Record<string, string | null>): void => {
    vi.spyOn(PlatformSettingsService, 'getSetting').mockImplementation(async (key: string) => values[key] ?? null);
  };

  afterEach(() => vi.restoreAllMocks());

  it('reads both settings on a single-site deployment', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    givenSettings({
      [SystemConstants.META_KEY.SITE_ENVIRONMENT]: 'non-production',
      [SystemConstants.META_KEY.SITE_SEARCH_INDEXING]: 'false',
    });
    expect(await StandaloneSitePolicy.isProduction()).toBe(false);
    expect(await StandaloneSitePolicy.isIndexable()).toBe(false);
  });

  it('keeps an upgraded single site live and indexed until somebody says otherwise', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    givenSettings({});
    expect(await StandaloneSitePolicy.isProduction()).toBe(true);
    expect(await StandaloneSitePolicy.isIndexable()).toBe(true);
  });

  it('treats a value nobody can name as production, as a site row does', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    givenSettings({ [SystemConstants.META_KEY.SITE_ENVIRONMENT]: 'staging' });
    expect(await StandaloneSitePolicy.isProduction()).toBe(true);
  });

  it('ignores both settings once the deployment has sites', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    givenSettings({
      [SystemConstants.META_KEY.SITE_ENVIRONMENT]: 'non-production',
      [SystemConstants.META_KEY.SITE_SEARCH_INDEXING]: 'false',
    });
    expect(await StandaloneSitePolicy.isProduction()).toBe(true);
    expect(await StandaloneSitePolicy.isIndexable()).toBe(true);
  });
});
