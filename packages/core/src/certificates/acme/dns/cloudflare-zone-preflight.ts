import { CloudflareDnsProvider } from '@core/certificates/acme/providers/cloudflare/cloudflare-dns-provider';

/**
 * Does this Cloudflare token actually manage the zone we are about to order for — asked BEFORE an
 * order, never after.
 *
 * `DnsPreflight`/`ChallengeReachabilityProbe` cannot stand in for this: both assume HTTP-01 and
 * check that the host's A/AAAA record points at this platform, which is the wrong question for
 * DNS-01 — a Cloudflare-proxied or DNS-only host never has to resolve to this platform at all, only
 * the Cloudflare zone has to accept a TXT record from this token. So a DNS-01 order gets its own
 * cheap local check: can this token see the zone at all.
 */
export class CloudflareZonePreflight {
  constructor(private readonly provider: CloudflareDnsProvider) {}

  /**
   * '' when the token can manage the zone, otherwise the reason it cannot — stored verbatim and
   * shown to the operator, because "cannot order" explains nothing a wrong-zone or a revoked-token
   * token does not.
   */
  async check(zoneName: string): Promise<string> {
    try {
      const canManage = await this.provider.canManageZone(zoneName);
      return canManage ? '' : `The Cloudflare token cannot see zone "${zoneName}" — it may belong to a different account, or the token's zone list does not include it.`;
    } catch (error: any) {
      return `Could not reach Cloudflare to check zone "${zoneName}": ${error?.message || error}`;
    }
  }
}
