import { AcmeAccountStore } from '@core/certificates/acme/acme-account-store';
import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';
import { AcmeCloudflareTokenStore } from '@core/certificates/acme/dns/acme-cloudflare-token-store';
import { AcmeDnsTokenResolver } from '@core/certificates/acme/dns/acme-dns-token-resolver';
import { CertificateIssuanceService } from '@core/certificates/acme/certificate-issuance-service';
import { CertificateStoreService } from '@core/certificates/certificate-store-service';

/**
 * The scheduled entry point for automatic certificates.
 *
 * Runs often — every five minutes — because most passes do nothing at all: with no authority
 * declared it returns immediately, and with nothing due it reads one small table. The frequency is
 * for the cases that matter, where a customer has just pointed their DNS and is watching the admin
 * to see it take. The per-host backoff, not the sweep interval, is what rations attempts.
 */
export class CertificateIssuanceTask {
  static readonly NAME = 'certificate-issuance';
  /** How often a sweep runs. The admin reads this to say when a queued host will next be checked. */
  static readonly INTERVAL_MINUTES = 5;
  static readonly SCHEDULE = `*/${CertificateIssuanceTask.INTERVAL_MINUTES} * * * *`;

  constructor(private readonly db: any) {}

  async run(): Promise<void> {
    const service = new CertificateIssuanceService(
      new CertificateStoreService(this.db),
      new AcmeAccountStore(this.db),
      new AcmeChallengeStore(this.db),
      new AcmeDnsTokenResolver(new AcmeCloudflareTokenStore(this.db)),
    );
    await service.sweep();
  }
}
