import { AcmeAccountStore } from '@core/certificates/acme/acme-account-store';
import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';
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
  static readonly SCHEDULE = '*/5 * * * *';

  constructor(private readonly db: any) {}

  async run(): Promise<void> {
    const service = new CertificateIssuanceService(
      new CertificateStoreService(this.db),
      new AcmeAccountStore(this.db),
      new AcmeChallengeStore(this.db),
    );
    await service.sweep();
  }
}
