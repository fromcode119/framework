import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';

/**
 * The registry is the one place a system setting is declared. The type already forces every
 * `META_KEY` value to have a descriptor; these cover what the type cannot see.
 */
describe('SystemSettingRegistry', () => {
  it('describes every declared key, and nothing it was never given', () => {
    const declared = Object.values(SystemConstants.META_KEY).map(String);

    expect(declared.length).toBeGreaterThan(0);
    for (const key of declared) expect(() => SystemSettingRegistry.describe(key as never)).not.toThrow();
    // Never guesses for a key it does not know — a plugin key, a per-user secret, a dedupe stamp.
    expect(() => SystemSettingRegistry.describe('totally_unknown_key' as never)).toThrow();
  });

  it('splits the declared keys into platform and site, with both non-empty', () => {
    const platform = SystemSettingRegistry.platformKeys();
    const declared = Object.values(SystemConstants.META_KEY).map(String);

    // An empty platform set compiles to `IN ()` in the row-level policy, which would hide every
    // deployment truth from every tenant; an all-platform set would make nothing per-site.
    expect(platform.length).toBeGreaterThan(0);
    expect(platform.length).toBeLessThan(declared.length);
    expect(platform).toContain(SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING);
    expect(platform).not.toContain(SystemConstants.META_KEY.SITE_NAME);
  });

  /**
   * The seeded defaults moved here from the api's boot seed. A thunk is how the few values that are
   * only knowable at boot (the app URLs, read from the environment) are declared, so the resolved
   * list must contain strings and nothing else — a function reaching the database would be written
   * as "() => ..." into `_system_meta`.
   */
  it('resolves every seeded default to a string, thunks included', () => {
    const defaults = SystemSettingRegistry.seedDefaults();

    expect(defaults.length).toBeGreaterThan(0);
    for (const entry of defaults) {
      expect(typeof entry.value).toBe('string');
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.group.length).toBeGreaterThan(0);
    }
  });

  it('keeps credential blobs out of what may be returned to a client', () => {
    const exposed = SystemSettingRegistry.exposedKeys();

    expect(exposed.has(SystemConstants.META_KEY.SITE_NAME)).toBe(true);
    expect(exposed.has(SystemConstants.META_KEY.INTEGRATION_EMAIL_PROFILES)).toBe(false);
    expect(exposed.has(SystemConstants.META_KEY.INTEGRATION_EMAIL_PROVIDER)).toBe(false);
  });
});
