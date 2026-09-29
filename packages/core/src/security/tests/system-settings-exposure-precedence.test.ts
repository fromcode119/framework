import { describe, expect, it } from 'vitest';
import { SystemSettingsExposureUtils } from '@core/security/system-settings-exposure-utils';

/** A site sees its own row and the platform's for an INHERITED key; its own must win, in any order. */
describe('SystemSettingsExposureUtils precedence', () => {
  const platform = { key: 'admin_default_locale', value: 'en', tenant_id: null };
  const site = { key: 'admin_default_locale', value: 'bg', tenant_id: 'shop' };

  it('answers with the site\'s own value whichever order the rows arrive in', () => {
    expect(SystemSettingsExposureUtils.toExposableSettingsMap([platform, site]).admin_default_locale).toBe('bg');
    expect(SystemSettingsExposureUtils.toExposableSettingsMap([site, platform]).admin_default_locale).toBe('bg');
  });

  it('answers with the platform\'s value for a site that has none of its own', () => {
    expect(SystemSettingsExposureUtils.toExposableSettingsMap([platform]).admin_default_locale).toBe('en');
  });
});
