import { AcmeDirectory } from '@core/certificates/acme/enums/acme-directory.enum';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SecretService } from '@core/security/secret-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * What the operator has declared about automatic issuance — and whether they have declared enough
 * of it for the platform to order anything at all.
 *
 * BLANK IS OFF, AND OFF IS STATED. There is no default authority and no default address, because
 * both would be the platform inventing a fact about somebody's deployment: an address customers are
 * told to point DNS at, and an authority it starts placing orders with. Either one guessed is worse
 * than the feature being switched off, so an incomplete configuration disables issuance and the
 * admin says which half is missing.
 */
export class AcmeSettings {
  private constructor(
    readonly directoryUrl: string,
    readonly contactEmail: string,
    readonly platformAddresses: readonly string[],
    /** Ciphertext as stored (or '' when unset) — decrypted lazily by {@link cloudflareToken}. */
    private readonly cloudflareTokenEnc: string,
  ) {}

  /** Read the declared settings. Never throws; unreadable settings read as blank, which is off. */
  static async load(): Promise<AcmeSettings> {
    const [directory, contact, addresses, cloudflareToken] = await Promise.all([
      PlatformSettingsService.getSetting(SystemConstants.META_KEY.CERTIFICATE_ACME_DIRECTORY),
      PlatformSettingsService.getSetting(SystemConstants.META_KEY.CERTIFICATE_ACME_CONTACT_EMAIL),
      PlatformSettingsService.getSetting(SystemConstants.META_KEY.CERTIFICATE_PLATFORM_ADDRESSES),
      PlatformSettingsService.getSetting(SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN),
    ]);

    return new AcmeSettings(
      String(directory ?? '').trim(),
      String(contact ?? '').trim(),
      AcmeSettings.parseAddresses(addresses),
      String(cloudflareToken ?? '').trim(),
    );
  }

  /**
   * The Cloudflare token, decrypted — for the DNS-01 provider and its preflight only. NEVER put
   * this in {@link toJson}; the admin sees only {@link isCloudflareConfigured}.
   */
  get cloudflareToken(): string {
    return this.cloudflareTokenEnc ? SecretService.decrypt(this.cloudflareTokenEnc) : '';
  }

  /**
   * Whether a token has been saved at all. Blank means DNS-01/wildcard issuance is unavailable.
   *
   * NEVER DECRYPTS. This is read on every Certificates page load and every source change —
   * including plain http-01 ones that have nothing to do with Cloudflare — so a token whose
   * ciphertext can no longer be decrypted (SECRET_KEY rotated or removed after it was saved) must
   * not throw from here and take the whole page down with it. Presence of ciphertext is all this
   * answers; the decrypt itself only ever happens in {@link cloudflareToken}, at the one call site
   * that actually places a DNS-01 order — `CertificateIssuanceService.attemptDns01`, which wraps
   * that read in its own try/catch and calls `recordFailure` on a decrypt failure. Letting the
   * throw escape to the sweep's outer catch instead would skip `recordFailure` — no `lastError`,
   * no `nextAttemptAt` — and leave the host perpetually "due" with nothing visible in the admin.
   */
  get isCloudflareConfigured(): boolean {
    return this.cloudflareTokenEnc.length > 0;
  }

  /** Whether the platform may place an order at all. Both halves are required. */
  get isConfigured(): boolean {
    return this.directoryUrl.length > 0 && this.platformAddresses.length > 0;
  }

  /** Which half is missing, for the admin to print. '' when nothing is. */
  get missingReason(): string {
    if (!this.directoryUrl && !this.platformAddresses.length) {
      return 'No certificate authority and no platform address are declared.';
    }
    if (!this.directoryUrl) return 'No certificate authority is declared.';
    if (!this.platformAddresses.length) return 'No platform address is declared.';
    return '';
  }

  /** The authority by name where it is one we know, otherwise the URL as entered. */
  get directoryLabel(): string {
    return AcmeDirectory.describe(this.directoryUrl);
  }

  /** Whether certificates from this authority will be untrusted by browsers. */
  get isTestAuthority(): boolean {
    return AcmeDirectory.find(this.directoryUrl)?.isTestAuthority === true;
  }

  /** What the admin prints as DNS instructions, and what a host is checked against. */
  toJson(): Record<string, unknown> {
    return {
      directoryUrl: this.directoryUrl,
      directoryLabel: this.directoryLabel,
      isTestAuthority: this.isTestAuthority,
      contactEmail: this.contactEmail,
      platformAddresses: [...this.platformAddresses],
      isConfigured: this.isConfigured,
      missingReason: this.missingReason,
      isCloudflareConfigured: this.isCloudflareConfigured,
    };
  }

  /** One address per line, or comma-separated — whichever the operator typed. */
  private static parseAddresses(raw: unknown): string[] {
    return String(raw ?? '')
      .split(/[\s,;]+/)
      .map((address) => address.trim().toLowerCase())
      .filter((address) => address.length > 0);
  }
}
