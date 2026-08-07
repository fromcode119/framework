import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingsExposureUtils } from '@core/security/system-settings-exposure-utils';

describe('SystemSettingsExposureUtils.isExposable', () => {
  it('exposes a declared system setting', () => {
    expect(SystemSettingsExposureUtils.isExposable(SystemConstants.META_KEY.SITE_NAME)).toBe(true);
    expect(SystemSettingsExposureUtils.isExposable(SystemConstants.META_KEY.RATE_LIMIT_MAX)).toBe(true);
  });

  it('EXCLUDES an unrecognised key by default — the allow-list never guesses', () => {
    for (const key of ['totally_unknown_key', 'entity_schema:mlm:affiliate', 'userpref:1:views', '']) {
      expect(SystemSettingsExposureUtils.isExposable(key)).toBe(false);
    }
  });

  it('excludes every credential/secret category the meta table also holds', () => {
    const secretKeys = [
      'auth:password_reset_token:abc123',
      'auth:verify_email_token:abc123',
      'auth:email_change_token:abc123',
      'auth:login_throttle:user@example.com|203.0.113.7',
      'user:1:totp_secret',
      'user:1:2fa_recovery_codes',
      'user:1:api_tokens',
      'scim:token',
      'assistant.session.42',
      SystemConstants.META_KEY.EMAIL_PROFILES,
      SystemConstants.META_KEY.EMAIL_PROVIDER,
      'integration_shipping_provider_providers',
    ];

    for (const key of secretKeys) {
      expect(SystemSettingsExposureUtils.isExposable(key)).toBe(false);
    }
  });
});

describe('SystemSettingsExposureUtils.toExposableSettingsMap', () => {
  it('keeps declared rows and drops everything else', () => {
    const map = SystemSettingsExposureUtils.toExposableSettingsMap([
      { key: SystemConstants.META_KEY.SITE_NAME, value: 'Acme' },
      { key: 'user:1:totp_secret', value: 'JBSWY3DPEHPK3PXP' },
      { key: 'auth:password_reset_token:abc', value: 'live-token' },
      { key: SystemConstants.META_KEY.EMAIL_PROFILES, value: '{"profiles":[]}' },
    ]);

    expect(Object.keys(map)).toEqual([SystemConstants.META_KEY.SITE_NAME]);
    expect(JSON.stringify(map)).not.toContain('JBSWY3DPEHPK3PXP');
    expect(JSON.stringify(map)).not.toContain('live-token');
  });

  it('parses JSON-shaped values only when asked', () => {
    const rows = [{ key: SystemConstants.META_KEY.DOMAIN_ALIASES, value: '["a.test","b.test"]' }];

    expect(SystemSettingsExposureUtils.toExposableSettingsMap(rows, { parseJson: true }))
      .toEqual({ [SystemConstants.META_KEY.DOMAIN_ALIASES]: ['a.test', 'b.test'] });
    expect(SystemSettingsExposureUtils.toExposableSettingsMap(rows))
      .toEqual({ [SystemConstants.META_KEY.DOMAIN_ALIASES]: '["a.test","b.test"]' });
  });

  it('returns an empty map for a non-array input rather than throwing', () => {
    expect(SystemSettingsExposureUtils.toExposableSettingsMap(null)).toEqual({});
    expect(SystemSettingsExposureUtils.toExposableSettingsMap(undefined)).toEqual({});
  });
});
