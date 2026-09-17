import type { IDnsChallengeRecord } from '@core/certificates/acme/interfaces/dns-challenge-record.interface';

/**
 * What `AcmeClientAdapter` needs from a DNS-01 provider — publish a TXT record and withdraw it
 * again — and nothing else. `AcmeClientAdapter` is the one place this platform speaks ACME; it must
 * not know which vendor answers DNS-01, only that something does. `CloudflareDnsProvider` satisfies
 * this today with no changes of its own; a second vendor would satisfy it the same way, injected by
 * whichever caller already knows which vendor it is (currently `CertificateIssuanceService`).
 */
export interface IDnsChallengeProvider {
  createChallengeRecord(zoneName: string, recordName: string, value: string): Promise<IDnsChallengeRecord>;
  removeChallengeRecord(record: IDnsChallengeRecord): Promise<void>;
}
