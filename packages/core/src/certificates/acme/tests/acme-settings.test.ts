import { afterEach, describe, expect, it } from 'vitest';
import { AcmeSettings } from '@core/certificates/acme/acme-settings';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * `AcmeSettings.isCloudflareConfigured` must NEVER throw, even when the saved token's ciphertext
 * can no longer be decrypted (a rotated or removed SECRET_KEY). It is read on every Certificates
 * page load and every source change — including plain http-01 ones — so a corrupt ciphertext
 * throwing from here would take down certificate management for every host on the platform, not
 * just DNS-01/wildcard, and would contradict this class's own "never throws" contract.
 */
describe('AcmeSettings — isCloudflareConfigured never decrypts', () => {
  afterEach(() => {
    // Restore to "nothing wired", the state every other suite in this process expects.
    PlatformSettingsService.registerAccessor(null as any);
  });

  const settingsWithAccessor = (values: Record<string, string | null>) => {
    PlatformSettingsService.registerAccessor(async (key: string) => values[key] ?? null);
    return AcmeSettings.load();
  };

  it('reports configured from ciphertext PRESENCE alone, without attempting to decrypt', async () => {
    // Not real ciphertext at all — if this getter ever tried to decrypt it, SecretService would
    // either throw ("malformed") or hand it back unchanged (it does not start with the encrypted
    // prefix). Either way, isCloudflareConfigured must answer true from presence alone.
    const settings = await settingsWithAccessor({
      [SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN]: 'enc:v1:not-a-real-payload',
    });

    expect(settings.isCloudflareConfigured).toBe(true);
  });

  it('a corrupt/undecryptable ciphertext does not throw from isCloudflareConfigured', async () => {
    // Well-formed enc:v1: envelope shape but garbage payload — this DOES throw when actually
    // decrypted (SecretService.decrypt throws "Stored secret is malformed." on it), which is
    // exactly the case a rotated/removed SECRET_KEY produces in production.
    const settings = await settingsWithAccessor({
      [SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN]: 'enc:v1:garbage',
    });

    expect(() => settings.isCloudflareConfigured).not.toThrow();
    expect(settings.isCloudflareConfigured).toBe(true);

    // The decrypt itself still throws — it just must never be reached by isCloudflareConfigured.
    expect(() => settings.cloudflareToken).toThrow();
  });

  it('toJson() — read on every Certificates page load — does not throw for a corrupt token', async () => {
    const settings = await settingsWithAccessor({
      [SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN]: 'enc:v1:garbage',
    });

    expect(() => settings.toJson()).not.toThrow();
    expect(settings.toJson().isCloudflareConfigured).toBe(true);
  });

  it('reports not configured when no token has been saved at all', async () => {
    const settings = await settingsWithAccessor({});
    expect(settings.isCloudflareConfigured).toBe(false);
    expect(settings.cloudflareToken).toBe('');
  });
});
