import {
  AcmeChallengeType, AcmeCloudflareTokenStore, AcmeDnsTokenResolver, AdminScope, ApplicationUrlUtils, CertificateAutomationUnavailableError,
  CertificateHostRole, CertificateRecord, CertificateRejection, CertificateSource, AcmeSettings, CertificateStoreService,
  CertificateValidationError, PlatformAddressDetection, SecretService, TenantRegistryService,
} from '@fromcode119/core';
import { CertificateAutomationStatus } from '@api/services/certificates/certificate-automation-status';
import { GatewayReloadClient } from '@api/services/tenants/gateway-reload-client';
import { CertificateHostEntry } from '@api/services/certificates/certificate-host-entry';
import { GatewayTlsStatusClient } from '@api/services/certificates/gateway-tls-status-client';

/**
 * What the admin's certificate screens read and write.
 *
 * The list is assembled from the hosts the platform actually SERVES, joined to whatever certificate
 * each one has — so a host with no certificate is a visible row rather than an absence. That is the
 * row an operator most needs to see, and a list built from the certificate table could never contain it.
 *
 * Every write ends in `GatewayReloadClient.notify()`, the same push a tenant change uses. There is
 * deliberately no second reload endpoint: one signal that means "your copy is stale" is easier to
 * keep correct than two that can disagree about which half changed.
 */
export class CertificateAdminService {
  /** Which token answers for a host's owner — its own, else the platform's. */
  private readonly dnsTokens: AcmeDnsTokenResolver;

  /** Whether automatic issuance is possible for a given scope, and why not when it is not. */
  private readonly automationStatus: CertificateAutomationStatus;

  constructor(
    private readonly certificates: CertificateStoreService,
    private readonly tenants: TenantRegistryService,
    private readonly cloudflareTokens: AcmeCloudflareTokenStore,
    private readonly reload: GatewayReloadClient = new GatewayReloadClient(),
    private readonly edgeStatus: GatewayTlsStatusClient = new GatewayTlsStatusClient(),
  ) {
    this.dnsTokens = new AcmeDnsTokenResolver(this.cloudflareTokens);
    this.automationStatus = new CertificateAutomationStatus(this.dnsTokens);
  }

  /**
   * Every served host with its certificate, plus the two facts that decide whether this screen can
   * promise anything: can this installation encrypt, and is anything here serving what it stores.
   */
  async overview(): Promise<Record<string, unknown>> {
    const entries = await this.entries();
    const edge = await this.edgeStatus.read();
    return {
      hosts: entries.map((entry) => entry.toJson()),
      encryptionAvailable: SecretService.isEncryptionAvailable(),
      warningDays: [...CertificateRecord.WARNING_DAYS],
      edge,
      automation: await this.automationStatus.describe(edge, null),
      // Nothing narrows this read, so the caller must be told that plainly rather than infer it from
      // an absent field. The admin's subtitle reads this to say whose hosts these are.
      scope: AdminScope.PLATFORM,
    };
  }

  /** The same rows, narrowed to one site — what its own Domains tab shows. */
  async forTenant(tenantId: string): Promise<Record<string, unknown>> {
    const entries = (await this.entries()).filter((entry) => entry.tenantId === tenantId);
    const edge = await this.edgeStatus.read();
    return {
      hosts: entries.map((entry) => entry.toJson()),
      encryptionAvailable: SecretService.isEncryptionAvailable(),
      warningDays: [...CertificateRecord.WARNING_DAYS],
      edge,
      automation: await this.automationStatus.describe(edge, tenantId),
      scope: AdminScope.SITE,
    };
  }

  /**
   * Which tenant owns a served host, resolved the same way the list itself is built.
   *
   * `undefined` means the platform does not serve this host at all; `null` means it serves it but the
   * host belongs to no tenant (one of the platform's own three). Both are "not this site" to a
   * tenant-scoped caller — the distinction exists only so `servedHosts()` stays the single place that
   * decides host ownership, instead of a second lookup a write route could get out of sync with.
   */
  async hostTenantId(host: string): Promise<string | null | undefined> {
    const served = (await this.servedHosts()).get(CertificateAdminService.normalize(host));
    return served ? served.tenantId : undefined;
  }


  /**
   * Store a pasted certificate for a host this platform serves.
   *
   * A host nobody routes is refused. Otherwise the table would accumulate certificates for names the
   * platform has no relationship with, which is both useless and the beginning of a place to hide
   * key material.
   */
  async upload(host: string, certificatePem: unknown, privateKeyPem: unknown): Promise<CertificateRecord> {
    const served = (await this.servedHosts()).get(CertificateAdminService.normalize(host));
    if (!served) {
      throw new CertificateValidationError(CertificateRejection.HOST_NOT_COVERED, String(host ?? ''));
    }

    const stored = await this.certificates.upload({
      host: served.host,
      tenantId: served.tenantId,
      certificatePem,
      privateKeyPem,
    });
    await this.reload.notify();
    return stored;
  }

  /**
   * Record who is responsible for a host's certificate. Serves whatever is stored either way.
   *
   * Choosing AUTOMATIC is refused when it could not work — no authority declared, no platform
   * address, or nothing here terminating TLS. Accepting it would leave a host quietly waiting for a
   * certificate that was never going to arrive, which is the failure mode this whole feature exists
   * to remove.
   *
   * `options.dnsWildcard` is the DNS-01 variant of AUTOMATIC: the same authority and platform
   * requirements apply, PLUS a Cloudflare token — refused, with the reason, when one has not been
   * saved. It is not a different `CertificateSource`; it is the same "the platform manages this"
   * choice with a different challenge, which is exactly what the new `challenge`/`wildcard` columns
   * exist to record.
   */
  async setSource(
    host: string,
    source: CertificateSource,
    options: { dnsWildcard?: boolean } = {},
  ): Promise<CertificateRecord | null> {
    const dnsWildcard = options.dnsWildcard === true;
    if (dnsWildcard && source !== CertificateSource.AUTOMATIC) {
      throw new CertificateAutomationUnavailableError('The DNS-01 wildcard variant only applies to the Automatic source.');
    }

    // Resolved from the host itself, never from the caller's ambient scope: the record must be
    // stamped with the site that actually owns the host, because that is what decides whose
    // Cloudflare token its DNS-01 orders will use. `undefined` (a host the platform does not serve)
    // becomes null — the same "belongs to no site" the platform's own hostnames have.
    const owner = (await this.hostTenantId(host)) ?? null;

    if (source.isPlatformManaged) {
      const edge = await this.edgeStatus.read();
      const automation = await this.automationStatus.describe(edge, owner);
      if (automation.isAvailable !== true) {
        throw new CertificateAutomationUnavailableError(String(automation.blockedReason || 'Automatic issuance is not available on this deployment.'));
      }
      if (dnsWildcard && automation.isCloudflareConfigured !== true) {
        throw new CertificateAutomationUnavailableError(
          owner
            ? 'No Cloudflare API token is saved for this site, and the platform has none either, so DNS-01/wildcard issuance is not available. Add one under this site\'s Certificates screen.'
            : 'No Cloudflare API token is saved, so DNS-01/wildcard issuance is not available. Add one under Settings → Certificates.',
        );
      }
    }

    const updated = await this.certificates.setSource(host, source, {
      challenge: dnsWildcard ? AcmeChallengeType.DNS_01 : AcmeChallengeType.HTTP_01,
      wildcard: dnsWildcard,
      tenantId: owner,
    });
    if (updated) await this.reload.notify();
    return updated;
  }

  /**
   * Store or clear the Cloudflare API token DNS-01 orders use.
   *
   * Encrypted at rest by `AcmeCloudflareTokenStore`; this method never returns it — only whether one
   * is now configured, the same shape as `automation()`. A blank value clears it, which is how the
   * feature is switched back off.
   */
  async setCloudflareToken(token: unknown, tenantId: string | null = null): Promise<Record<string, unknown>> {
    await this.cloudflareTokens.set(String(token ?? ''), tenantId);
    const resolved = await this.dnsTokens.resolve(tenantId);
    return {
      isCloudflareConfigured: resolved.isConfigured,
      cloudflareTokenScope: String(resolved.scope.value),
      isCloudflareTokenInherited: resolved.isPlatformFallback && tenantId !== null,
    };
  }

  /** Forget a host's certificate. The host keeps routing; it simply has nothing to serve over TLS. */
  async remove(host: string): Promise<boolean> {
    const removed = await this.certificates.remove(host);
    if (removed) await this.reload.notify();
    return removed;
  }

  /**
   * What this platform's own hostnames resolve to — a suggestion for the addresses setting.
   *
   * Never stored from here. The admin shows the hostname beside the answer so the operator can see
   * where it came from and judge whether it is this machine or something sitting in front of it.
   */
  async detectPlatformAddresses(): Promise<Array<Record<string, unknown>>> {
    const platform = [...(await this.servedHosts()).values()].filter((entry) => entry.role.isPlatform);
    const detected = await PlatformAddressDetection.system().detect(platform.map((entry) => entry.host));
    return detected.map((candidate) => candidate.toJson());
  }

  /**
   * Served hosts joined to stored certificates, ORDERED BY WHAT RUNS OUT SOONEST.
   *
   * The screen says "soonest to expire first", so that has to be what it does — an expired
   * certificate sitting halfway down an alphabetical list is the one row nobody can afford to scroll
   * past. Hosts with no certificate come last: on a deployment whose TLS is terminated elsewhere
   * that is the normal, uninteresting state for every host, and putting it first would bury the
   * certificates that are actually about to lapse.
   */
  private async entries(): Promise<CertificateHostEntry[]> {
    const served = await this.servedHosts();
    const stored = new Map((await this.certificates.list()).map((record) => [record.host, record]));

    return [...served.values()]
      .map((host) => new CertificateHostEntry(host.host, host.role, host.tenantId, host.tenantSlug, stored.get(host.host) ?? null))
      .sort((left, right) => CertificateAdminService.compare(left, right));
  }

  /** Soonest expiry first; then hosts with nothing stored, the platform's own first. */
  private static compare(left: CertificateHostEntry, right: CertificateHostEntry): number {
    const leftExpiry = left.certificate?.notAfter?.getTime() ?? null;
    const rightExpiry = right.certificate?.notAfter?.getTime() ?? null;

    if (leftExpiry !== null && rightExpiry !== null) {
      return leftExpiry === rightExpiry ? left.host.localeCompare(right.host) : leftExpiry - rightExpiry;
    }
    if (leftExpiry !== null) return -1;
    if (rightExpiry !== null) return 1;

    if (left.role.isPlatform !== right.role.isPlatform) return left.role.isPlatform ? -1 : 1;
    return left.host.localeCompare(right.host);
  }

  /**
   * Every host this platform answers for, keyed by host.
   *
   * The platform's own three come from the configured app URLs — the same source the routing map
   * uses — so this list cannot drift from what is actually routed. A URL that is not configured
   * contributes nothing rather than a guessed hostname.
   */
  private async servedHosts(): Promise<Map<string, CertificateHostEntry>> {
    const hosts = new Map<string, CertificateHostEntry>();

    // TENANTS FIRST, and a tenant's host is never overwritten by a platform URL below.
    //
    // The order used to be the other way round, and a host claimed by a configured app URL was
    // skipped in this loop — so when `FRONTEND_URL` named a site's own primary host (which is what a
    // single-site deployment looks like), that host was recorded with NO tenant and the site's own
    // Domains tab, which filters by tenant, said "no hosts are configured on this platform yet"
    // about a site that plainly had one. The tenant is the more specific claim: it says WHOSE host
    // this is, which is the question this list exists to answer.
    for (const tenant of await this.tenants.list()) {
      for (const host of tenant.hosts()) {
        const normalized = CertificateAdminService.normalize(host);
        if (!normalized || hosts.has(normalized)) continue;
        const role = normalized === CertificateAdminService.normalize(tenant.primaryHost)
          ? CertificateHostRole.PRIMARY
          : CertificateHostRole.ALIAS;
        hosts.set(normalized, new CertificateHostEntry(normalized, role, tenant.id, tenant.slug, null));
      }
    }

    const platform: Array<[string, CertificateHostRole]> = [
      [ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP), CertificateHostRole.PLATFORM_ADMIN],
      [ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP), CertificateHostRole.PLATFORM_API],
      [ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP), CertificateHostRole.PLATFORM_FRONTEND],
    ];
    for (const [url, role] of platform) {
      const host = CertificateAdminService.hostOfUrl(url);
      if (host && !hosts.has(host)) hosts.set(host, new CertificateHostEntry(host, role, null, null, null));
    }

    return hosts;
  }

  /** The hostname of a configured app URL, or '' when nothing is configured. Never a guessed default. */
  private static hostOfUrl(url: string): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  private static normalize(host: unknown): string {
    return String(host ?? '').trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
  }
}
