import {
  ApplicationUrlUtils, CertificateHostRole, CertificateRecord, CertificateRejection, CertificateSource,
  CertificateStoreService, CertificateValidationError, SecretService, TenantRegistryService,
} from '@fromcode119/core';
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
  constructor(
    private readonly certificates: CertificateStoreService,
    private readonly tenants: TenantRegistryService,
    private readonly reload: GatewayReloadClient = new GatewayReloadClient(),
    private readonly edgeStatus: GatewayTlsStatusClient = new GatewayTlsStatusClient(),
  ) {}

  /**
   * Every served host with its certificate, plus the two facts that decide whether this screen can
   * promise anything: can this installation encrypt, and is anything here serving what it stores.
   */
  async overview(): Promise<Record<string, unknown>> {
    const entries = await this.entries();
    return {
      hosts: entries.map((entry) => entry.toJson()),
      encryptionAvailable: SecretService.isEncryptionAvailable(),
      warningDays: [...CertificateRecord.WARNING_DAYS],
      edge: await this.edgeStatus.read(),
    };
  }

  /** The same rows, narrowed to one site — what its own Domains tab shows. */
  async forTenant(tenantId: string): Promise<Record<string, unknown>> {
    const entries = (await this.entries()).filter((entry) => entry.tenantId === tenantId);
    return {
      hosts: entries.map((entry) => entry.toJson()),
      encryptionAvailable: SecretService.isEncryptionAvailable(),
      warningDays: [...CertificateRecord.WARNING_DAYS],
      edge: await this.edgeStatus.read(),
    };
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

  /** Record who is responsible for a host's certificate. Serves whatever is stored either way. */
  async setSource(host: string, source: CertificateSource): Promise<CertificateRecord | null> {
    const updated = await this.certificates.setSource(host, source);
    if (updated) await this.reload.notify();
    return updated;
  }

  /** Forget a host's certificate. The host keeps routing; it simply has nothing to serve over TLS. */
  async remove(host: string): Promise<boolean> {
    const removed = await this.certificates.remove(host);
    if (removed) await this.reload.notify();
    return removed;
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

    const platform: Array<[string, CertificateHostRole]> = [
      [ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP), CertificateHostRole.PLATFORM_ADMIN],
      [ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP), CertificateHostRole.PLATFORM_API],
      [ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP), CertificateHostRole.PLATFORM_FRONTEND],
    ];
    for (const [url, role] of platform) {
      const host = CertificateAdminService.hostOfUrl(url);
      if (host && !hosts.has(host)) hosts.set(host, new CertificateHostEntry(host, role, null, null, null));
    }

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
