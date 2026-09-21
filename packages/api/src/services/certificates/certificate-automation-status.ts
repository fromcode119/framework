import { AcmeDnsTokenResolver, AcmeSettings } from '@fromcode119/core';

/**
 * Whether the platform can obtain certificates itself for a given scope, and when it cannot, why.
 *
 * Both halves have to be true and neither can be guessed: an authority the operator named, and this
 * deployment's own gateway doing the terminating. The admin prints the reason rather than offering a
 * control that would spend a rate limit to produce something nothing serves.
 *
 * Its own class because the answer is no longer one fact about the deployment. The DNS-01 half now
 * depends on WHOSE zone is being proved — a site may hold its own Cloudflare token — so this is
 * asked once per scope, by two different screens, and the admin service was over its size budget
 * carrying it.
 */
export class CertificateAutomationStatus {
  constructor(private readonly dnsTokens: AcmeDnsTokenResolver) {}

  /**
   * `tenantId` is the scope being reported on: a site's id for that site's Certificates screen,
   * `null` for the platform-wide one.
   */
  async describe(
    edge: Record<string, unknown> | null,
    tenantId: string | null,
  ): Promise<Record<string, unknown>> {
    const settings = await AcmeSettings.load();
    const terminatesTls = edge?.tls === true;
    const blocked = !settings.isConfigured
      ? settings.missingReason
      : (terminatesTls ? '' : 'This deployment\'s gateway is not terminating TLS, so a certificate it obtained would not be served by anything here.');

    // Scope-aware, because a token belongs to whoever owns the DNS. `settings.toJson()` answers only
    // for the platform's own row, which inside a site is the wrong question: a site with its own
    // token would read as unconfigured, and one without would read as configured by a credential
    // that cannot see its zone. The scope is reported alongside so the screen can SAY which is in
    // use rather than leaving the operator to guess — the same rule as any other inherited value.
    const dnsToken = await this.dnsTokens.resolve(tenantId);

    return {
      ...settings.toJson(),
      terminatesTls,
      isAvailable: blocked.length === 0,
      blockedReason: blocked,
      isCloudflareConfigured: dnsToken.isConfigured,
      cloudflareTokenScope: String(dnsToken.scope.value),
      // Only meaningful inside a site: true when this site is borrowing the platform's token.
      isCloudflareTokenInherited: dnsToken.isPlatformFallback && tenantId !== null,
      // The DNS-01/wildcard variant needs everything AUTOMATIC needs, PLUS a usable Cloudflare token.
      dnsWildcardAvailable: blocked.length === 0 && dnsToken.isConfigured,
    };
  }
}
