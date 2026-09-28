import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';
import { TenantImportRowFilter } from '@core/tenant/provisioning/tenant-import-row-filter';

const meta = { name: SystemConstants.TABLE.META } as any;

/**
 * An INHERITED setting has a site row as well as the platform's — the site's own choice — so an
 * imported site brings it. A platform-only setting stays the destination's.
 */
describe('importing site settings', () => {
  const skip = TenantImportRowFilter.forTable(meta, new Set());

  it('keeps the site\'s own console language and marketplace', () => {
    expect(skip({ key: SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE, value: 'bg' })).toBe(false);
    expect(skip({ key: SystemConstants.META_KEY.MARKETPLACE_URL, value: 'https://catalogue.example' })).toBe(false);
  });

  it('still leaves every platform-only setting behind', () => {
    const inherited = new Set(SystemSettingRegistry.inheritedKeys());
    const platformOnly = SystemSettingRegistry.platformKeys().filter((key) => !inherited.has(key));
    expect(platformOnly.length).toBeGreaterThan(0);
    for (const key of platformOnly) expect(skip({ key, value: 'x' })).toBe(true);
  });
});
