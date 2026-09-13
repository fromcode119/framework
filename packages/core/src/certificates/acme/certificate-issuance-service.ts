import { AcmeAccountStore } from '@core/certificates/acme/acme-account-store';
import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';
import { AcmeClientAdapter } from '@core/certificates/acme/acme-client-adapter';
import { AcmeSettings } from '@core/certificates/acme/acme-settings';
import { CertificateIssuanceBackoff } from '@core/certificates/acme/certificate-issuance-backoff';
import { CertificateMaterial } from '@core/certificates/certificate-material';
import { CertificateRecord } from '@core/certificates/certificate-record';
import { CertificateSource } from '@core/enums/certificate-source.enum';
import { CertificateState } from '@core/enums/certificate-state.enum';
import { CertificateStoreService } from '@core/certificates/certificate-store-service';
import { ChallengeReachabilityProbe } from '@core/certificates/acme/challenge-reachability-probe';
import { DnsPreflight } from '@core/certificates/acme/dns-preflight';
import { Logger } from '@core/logging';

/**
 * Obtains and renews the certificates the platform manages.
 *
 * THE ORDER OF THE CHECKS IS THE FEATURE. Nothing reaches the certificate authority until DNS points
 * here and our own challenge path has answered correctly, because a failed validation is rationed —
 * five per hostname per hour — and the two cheap local checks catch almost every reason a real
 * validation would fail. A platform that ordered first and learned afterwards would lock itself out
 * of a customer's domain for an hour at a time, during the hour somebody is trying to fix it.
 */
export class CertificateIssuanceService {
  /** Per sweep, platform-wide. A hundred new hosts must not become a hundred orders in a minute. */
  private static readonly MAX_ORDERS_PER_SWEEP = 5;
  /** An attempt still marked in-flight after this long was interrupted, not running. */
  private static readonly STALE_ISSUING_MS = 15 * 60 * 1000;

  private readonly logger = new Logger({ namespace: 'certificate-issuance' });

  constructor(
    private readonly store: CertificateStoreService,
    private readonly accounts: AcmeAccountStore,
    private readonly challenges: AcmeChallengeStore,
    private readonly preflight: DnsPreflight = DnsPreflight.system(),
    private readonly probe: ChallengeReachabilityProbe | null = null,
    private readonly adapter: AcmeClientAdapter | null = null,
  ) {}

  /** One pass. Never throws: a sweep that dies takes every other host's renewal with it. */
  async sweep(): Promise<void> {
    const settings = await AcmeSettings.load();
    if (!settings.isConfigured) return;

    await this.challenges.prune();
    await this.releaseStaleClaims();

    const due = (await this.store.list()).filter((record) => CertificateIssuanceService.isDue(record));
    for (const record of due.slice(0, CertificateIssuanceService.MAX_ORDERS_PER_SWEEP)) {
      try {
        await this.attempt(record, settings);
      } catch (error: any) {
        this.logger.warn(`Issuance for ${record.host} failed unexpectedly: ${error?.message || error}`);
      }
    }
  }

  /** Whether this row wants an attempt now. */
  private static isDue(record: CertificateRecord): boolean {
    if (record.source !== CertificateSource.AUTOMATIC) return false;
    if (record.nextAttemptAt && record.nextAttemptAt.getTime() > Date.now()) return false;
    if (record.storedState === CertificateState.ISSUING) return false;

    const state = record.state;
    return !record.hasMaterial
      || state === CertificateState.RENEWAL_DUE
      || state === CertificateState.EXPIRED
      || record.storedState === CertificateState.FAILED
      || record.storedState === CertificateState.WAITING_FOR_DNS;
  }

  /**
   * One host: check, claim, order, store.
   *
   * Each refusal writes a different state and a different retry delay, because they mean different
   * things to whoever has to fix them — and because only one of them costs anything at the authority.
   */
  private async attempt(record: CertificateRecord, settings: AcmeSettings): Promise<void> {
    const dns = await this.preflight.check(record.host, settings.platformAddresses);
    if (!dns.isPointingHere) {
      await this.store.markWaitingForDns(
        record.host,
        dns.describe(),
        CertificateIssuanceBackoff.after(CertificateIssuanceBackoff.DNS_RECHECK_MS),
      );
      return;
    }

    const probe = this.probe ?? new ChallengeReachabilityProbe(this.challenges);
    const unreachable = await probe.check(record.host);
    if (unreachable) {
      // Not the authority's fault and not counted against its budget — this never reached it.
      await this.store.recordFailure(
        record.host,
        unreachable,
        record.attemptsInWindow,
        CertificateIssuanceBackoff.after(CertificateIssuanceBackoff.UNREACHABLE_RECHECK_MS),
      );
      return;
    }

    const claimed = await this.store.claimForIssuance(record.host, record.storedState);
    if (!claimed) return;

    await this.order(record, settings);
  }

  /** The part that spends a rate limit. Everything above has already proved it should succeed. */
  private async order(record: CertificateRecord, settings: AcmeSettings): Promise<void> {
    const adapter = this.adapter ?? new AcmeClientAdapter(this.challenges);
    try {
      const account = await this.resolveAccount(settings);
      const issued = await adapter.issue({
        directoryUrl: settings.directoryUrl,
        accountKeyPem: account.privateKeyPem,
        accountUrl: account.accountUrl || undefined,
        contactEmail: settings.contactEmail || undefined,
        host: record.host,
      });

      if (issued.accountUrl && issued.accountUrl !== account.accountUrl) {
        await this.accounts.save(settings.directoryUrl, issued.accountUrl, account.privateKeyPem, settings.contactEmail);
      }

      // Parsed through the same gate an uploaded certificate passes, so an authority that returned
      // something for the wrong name is caught here rather than at a visitor's handshake.
      const material = CertificateMaterial.parse(issued.certificatePem, issued.privateKeyPem, record.host);
      await this.store.storeIssued(record.host, record.tenantId, material);
      this.logger.info(`Issued a certificate for ${record.host}, valid until ${material.notAfter.toISOString().slice(0, 10)}.`);
    } catch (error: any) {
      // The authority's own problem detail, verbatim: a paraphrase of "CAA record forbids issuance"
      // helps nobody.
      const reason = String(error?.detail || error?.message || error);
      const attempts = record.attemptsInWindow + 1;
      await this.store.recordFailure(record.host, reason, attempts, CertificateIssuanceBackoff.nextAttemptAfter(attempts));
      this.logger.warn(`Could not issue a certificate for ${record.host}: ${reason}`);
    }
  }

  /** The account for this authority, registering one the first time it is needed. */
  private async resolveAccount(settings: AcmeSettings): Promise<{ accountUrl: string; privateKeyPem: string }> {
    const existing = await this.accounts.find(settings.directoryUrl);
    if (existing) return existing;

    const privateKeyPem = await AcmeClientAdapter.createAccountKey();
    await this.accounts.save(settings.directoryUrl, '', privateKeyPem, settings.contactEmail);
    return { accountUrl: '', privateKeyPem };
  }

  /**
   * Rows left mid-flight by a restart.
   *
   * Without this a process that died during an order leaves the host marked ISSUING forever, and
   * `isDue` skips it — a certificate that silently never renews, which is exactly the failure this
   * whole feature exists to prevent.
   */
  private async releaseStaleClaims(): Promise<void> {
    const cutoff = Date.now() - CertificateIssuanceService.STALE_ISSUING_MS;
    for (const record of await this.store.list()) {
      if (record.storedState !== CertificateState.ISSUING) continue;
      if (record.lastAttemptAt && record.lastAttemptAt.getTime() > cutoff) continue;
      await this.store.recordFailure(
        record.host,
        'The previous attempt was interrupted before it finished.',
        record.attemptsInWindow,
        CertificateIssuanceBackoff.after(CertificateIssuanceBackoff.UNREACHABLE_RECHECK_MS),
      );
    }
  }
}
