import { AcmeCloudflareTokenStore } from '@core/certificates/acme/dns/acme-cloudflare-token-store';
import { AcmeDnsTokenResolution } from '@core/certificates/acme/dns/acme-dns-token-resolution';
import { AcmeTokenScope } from '@core/certificates/acme/enums/acme-token-scope.enum';

/**
 * Which Cloudflare token answers for a host: its owner's, or the platform's.
 *
 * THE PRECEDENCE IS OWNER FIRST, and it is the whole point. DNS-01 proves control of a zone by
 * writing into it, so the credential has to belong to whoever controls that zone — on a
 * multi-tenant platform that is normally the customer, whose domain lives in the customer's own
 * Cloudflare account. A site that has saved its own token uses it; one that has not falls back to
 * the platform's, which is the right answer for the platform's own hostnames and for a customer
 * whose domain genuinely does sit in our account.
 *
 * The platform token is a FALLBACK, never an override: a site that has stored its own is never
 * silently served by somebody else's credential. And when neither exists the answer is
 * {@link AcmeTokenScope.NONE} rather than an empty string, so the caller states which scope is
 * missing instead of reporting a blank token.
 */
export class AcmeDnsTokenResolver {
  constructor(private readonly store: AcmeCloudflareTokenStore) {}

  /**
   * Resolve for one certificate's owning tenant. `null` means a host owned by no site, which can
   * only use the platform's.
   *
   * Never decrypts — the resolution carries ciphertext, so the admin can ask this on every page
   * load without touching `SECRET_KEY`.
   */
  async resolve(tenantId: string | null): Promise<AcmeDnsTokenResolution> {
    if (tenantId) {
      const own = await this.store.readCiphertext(tenantId);
      if (own) return new AcmeDnsTokenResolution(AcmeTokenScope.SITE, own);
    }

    const platform = await this.store.readCiphertext(null);
    if (platform) return new AcmeDnsTokenResolution(AcmeTokenScope.PLATFORM, platform);

    return AcmeDnsTokenResolution.none();
  }
}
