import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { CertificateHost } from '@/lib/certificates/certificate-host';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The admin's client for `/system/admin/certificates`. Every call is a platform-admin call.
 *
 * `edge` is what the platform's own gateway reports about itself, carried through unchanged so the
 * page can say plainly whether anything here is actually serving what it stores — rather than
 * implying that uploading a certificate put it on the wire.
 */
export class CertificatesClient {
  static async list(tenantId?: string): Promise<{
    hosts: CertificateHost[];
    encryptionAvailable: boolean;
    warningDays: number[];
    edge: Record<string, unknown> | null;
    automation: Record<string, unknown> | null;
    /**
     * `'platform'` for the whole-box read, or the tenant id when the api narrowed it — either because
     * this call passed `tenantId`, or because the request itself was bound to a site server-side (an
     * operator who has stepped into a site gets that site's rows back even without asking for them).
     * The caller reads this to know WHOSE hosts it is looking at, not just how many.
     */
    scope: string;
  }> {
    const endpoint = tenantId
      ? `${AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATES}?tenantId=${encodeURIComponent(tenantId)}`
      : AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATES;
    const response = await AdminApi.get(endpoint, { noDedupe: true });
    return {
      hosts: CertificateHost.fromList(response?.hosts),
      encryptionAvailable: response?.encryptionAvailable === true,
      warningDays: Array.isArray(response?.warningDays) ? response.warningDays.map((d: unknown) => Number(d)) : [],
      edge: (response?.edge ?? null) as Record<string, unknown> | null,
      automation: (response?.automation ?? null) as Record<string, unknown> | null,
      scope: typeof response?.scope === 'string' && response.scope ? response.scope : 'platform',
    };
  }

  /**
   * Hand a host to the platform to obtain and renew, or take it back.
   *
   * The api refuses AUTOMATIC when it could not work — no authority declared, or nothing here
   * terminating TLS — and the message it returns is what the caller shows. `dnsWildcard` asks for
   * the DNS-01 variant (`*.<host>` included), refused separately when no Cloudflare token is saved.
   */
  static async setSource(host: string, source: string, dnsWildcard = false): Promise<void> {
    await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATE_SOURCE(host), { source, dnsWildcard });
  }

  /**
   * Store or clear the Cloudflare API token DNS-01/wildcard orders use.
   *
   * The response never carries the token back — only whether one is now configured, the same shape
   * `automation.isCloudflareConfigured` already reports — plus the hosts that had failed on the old
   * token and are now queued for the next check, so the caller can name them.
   */
  static async setCloudflareToken(token: string): Promise<{ isCloudflareConfigured: boolean; requeuedHosts: string[] }> {
    const response = await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATE_CLOUDFLARE_TOKEN, { token });
    return {
      isCloudflareConfigured: response?.isCloudflareConfigured === true,
      requeuedHosts: Array.isArray(response?.requeuedHosts) ? response.requeuedHosts.map((host: unknown) => String(host)) : [],
    };
  }

  /**
   * Store a certificate for a host.
   *
   * A refusal comes back as a 422 carrying WHICH refusal it was; the caller shows that rather than a
   * generic failure, because "invalid certificate" sends an operator back to their issuer to
   * re-download both files when only one of them is wrong.
   */
  static async upload(host: string, certificatePem: string, privateKeyPem: string): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATES, { host, certificatePem, privateKeyPem });
  }

  /**
   * What this platform's own hostnames resolve to — a suggestion, not a setting.
   *
   * On its own call rather than part of the list, because it costs DNS lookups and the certificates
   * page should not pay for them on every load.
   */
  static async detectPlatformAddresses(): Promise<Array<{ host: string; ipv4: string[]; ipv6: string[] }>> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATE_PLATFORM_ADDRESSES, { noDedupe: true })
      .catch(() => null);
    const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
    return candidates.map((entry: any) => ({
      host: String(entry?.host ?? ''),
      ipv4: Array.isArray(entry?.ipv4) ? entry.ipv4.map((a: unknown) => String(a)) : [],
      ipv6: Array.isArray(entry?.ipv6) ? entry.ipv6.map((a: unknown) => String(a)) : [],
    }));
  }

  static async remove(host: string): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATE(host));
  }

  /** What an upload refusal means, in a sentence. Keyed by the reason code the api returns. */
  static reasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      certificate_unreadable: AdminI18n.t('lib.thatIsNotAReadable'),
      private_key_unreadable: AdminI18n.t('lib.thatIsNotAReadable2'),
      key_mismatch: AdminI18n.t('lib.theKeyDoesNotMatch'),
      already_expired: AdminI18n.t('lib.thatCertificateHasAlreadyExpired'),
      host_not_covered: AdminI18n.t('lib.thatCertificateWasNotIssued'),
      encryption_unavailable: AdminI18n.t('lib.thisInstallationCannotStoreA'),
    };
    return labels[reason] ?? AdminI18n.t('lib.theCertificateWasRefused');
  }
}
