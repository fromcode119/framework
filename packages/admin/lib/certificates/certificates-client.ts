import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { CertificateHost } from '@/lib/certificates/certificate-host';

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
    };
  }

  /**
   * Hand a host to the platform to obtain and renew, or take it back.
   *
   * The api refuses AUTOMATIC when it could not work — no authority declared, or nothing here
   * terminating TLS — and the message it returns is what the caller shows.
   */
  static async setSource(host: string, source: string): Promise<void> {
    await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.CERTIFICATE_SOURCE(host), { source });
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
      certificate_unreadable: 'That is not a readable certificate. Paste the PEM text, including the BEGIN and END lines.',
      private_key_unreadable: 'That is not a readable private key. A passphrase-protected key cannot be used — the platform would have to hold the passphrase too.',
      key_mismatch: 'The key does not match the certificate. They are usually from different orders.',
      already_expired: 'That certificate has already expired, so storing it would put a broken one live.',
      host_not_covered: 'That certificate was not issued for this host, so browsers would reject it.',
      encryption_unavailable: 'This installation cannot store a private key: no SECRET_KEY is configured on the server.',
    };
    return labels[reason] ?? 'The certificate was refused.';
  }
}
