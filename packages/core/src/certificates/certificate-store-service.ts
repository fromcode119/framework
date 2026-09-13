import { CertificateMaterial } from '@core/certificates/certificate-material';
import { CertificateRecord } from '@core/certificates/certificate-record';
import { CertificateRejection } from '@core/enums/certificate-rejection.enum';
import { CertificateSource } from '@core/enums/certificate-source.enum';
import { CertificateState } from '@core/enums/certificate-state.enum';
import { CertificateValidationError } from '@core/certificates/certificate-validation-error';
import { SecretService } from '@core/security/secret-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The only writer of `_system_certificates`, and the only place a private key is encrypted or read
 * back out.
 *
 * Keeping both sides in one class is the point: a second path that wrote a key would be a second
 * path that could write it in the clear, and a second path that read one would be a second place to
 * audit. Everything above this — routes, admin, the expiry sweep — deals in `CertificateRecord`.
 *
 * System table, so the raw manager and snake_case columns.
 */
export class CertificateStoreService {
  private static readonly TABLE = SystemConstants.TABLE.CERTIFICATES;

  constructor(private readonly db: any) {}

  /** Every certificate the platform holds, soonest to expire first — the order the admin lists them in. */
  async list(): Promise<CertificateRecord[]> {
    const rows: Array<Record<string, any>> = await this.db.find(CertificateStoreService.TABLE, {
      orderBy: { not_after: 'asc' },
    });
    return (rows ?? []).map((row) => CertificateRecord.from(row));
  }

  /** The rows for one set of hosts. Used by a site's own page, which knows only its hosts. */
  async listForHosts(hosts: readonly string[]): Promise<CertificateRecord[]> {
    const wanted = new Set(hosts.map((host) => CertificateStoreService.normalizeHost(host)).filter(Boolean));
    if (!wanted.size) return [];
    return (await this.list()).filter((record) => wanted.has(record.host));
  }

  async find(host: string): Promise<CertificateRecord | null> {
    const normalized = CertificateStoreService.normalizeHost(host);
    if (!normalized) return null;
    const row = await this.db.findOne(CertificateStoreService.TABLE, { host: normalized });
    return row ? CertificateRecord.from(row) : null;
  }

  /**
   * Store a certificate an operator pasted.
   *
   * Validation happens BEFORE anything is written, so a refused upload leaves whatever was already
   * serving untouched — replacing a working certificate with a broken one is the failure this order
   * prevents.
   *
   * `last_warned_days` is cleared, because the warnings belong to the certificate and this is a new
   * one; leaving it would silence the first warning for the replacement.
   */
  async upload(input: { host: unknown; tenantId?: unknown; certificatePem: unknown; privateKeyPem: unknown }): Promise<CertificateRecord> {
    if (!SecretService.isEncryptionAvailable()) {
      throw new CertificateValidationError(CertificateRejection.ENCRYPTION_UNAVAILABLE);
    }

    const host = CertificateStoreService.normalizeHost(input.host);
    if (!host) {
      throw new CertificateValidationError(CertificateRejection.HOST_NOT_COVERED, String(input.host ?? ''));
    }

    const material = CertificateMaterial.parse(input.certificatePem, input.privateKeyPem, host);

    await this.write(host, {
      tenant_id: input.tenantId ? String(input.tenantId) : null,
      source: String(CertificateSource.UPLOADED.value),
      state: String(CertificateState.SERVING.value),
      certificate_pem: material.certificatePem,
      private_key_enc: SecretService.encrypt(material.privateKeyPem),
      issuer: material.issuer,
      subject_alt_names: JSON.stringify(material.subjectAltNames),
      serial: material.serial,
      fingerprint_sha256: material.fingerprintSha256,
      not_before: material.notBefore,
      not_after: material.notAfter,
      last_error: '',
      last_attempt_at: new Date(),
      next_attempt_at: null,
      attempts_in_window: 0,
      last_warned_days: null,
    });

    const stored = await this.find(host);
    if (!stored) throw new Error(`Certificate for "${host}" was not found after being stored.`);
    return stored;
  }

  /**
   * Change who is responsible for a host's certificate.
   *
   * Switching to a source the platform has not implemented yet must not pretend to do anything, so
   * this only records the choice; whatever is stored keeps serving until something replaces it.
   */
  async setSource(host: string, source: CertificateSource): Promise<CertificateRecord | null> {
    const normalized = CertificateStoreService.normalizeHost(host);
    if (!normalized) return null;
    await this.write(normalized, { source: String(source.value) });
    return this.find(normalized);
  }

  /** Forget a host's certificate entirely. The host keeps routing; it just has nothing to serve over TLS. */
  async remove(host: string): Promise<boolean> {
    const normalized = CertificateStoreService.normalizeHost(host);
    if (!normalized) return false;
    const existing = await this.find(normalized);
    if (!existing) return false;
    await this.db.delete(CertificateStoreService.TABLE, { host: normalized });
    return true;
  }

  /**
   * Take ownership of a host for one issuance attempt, or return null because somebody else has it.
   *
   * The state goes in the WHERE, so two sweeps racing produce one winner and one null rather than
   * two orders for the same host — which would spend the authority's budget twice for one
   * certificate. This is the optimistic-lock pattern the repo already applies to money and stock,
   * for the same reason: the check and the write have to be one statement.
   */
  async claimForIssuance(host: string, expected: CertificateState): Promise<CertificateRecord | null> {
    const normalized = CertificateStoreService.normalizeHost(host);
    if (!normalized) return null;

    const claimed = await this.db.update(
      CertificateStoreService.TABLE,
      { host: normalized, state: String(expected.value) },
      { state: String(CertificateState.ISSUING.value), last_attempt_at: new Date(), updated_at: new Date() },
    );
    if (!claimed) return null;
    return this.find(normalized);
  }

  /**
   * Store a certificate the platform obtained itself.
   *
   * Deliberately the same payload shape as an upload, plus the source: a certificate is a
   * certificate however it arrived, and a second slightly-different write path is how the two drift
   * until one of them forgets to clear the warning marker.
   */
  async storeIssued(host: string, tenantId: string | null, material: CertificateMaterial): Promise<CertificateRecord | null> {
    const normalized = CertificateStoreService.normalizeHost(host);
    if (!normalized) return null;

    await this.write(normalized, {
      tenant_id: tenantId,
      source: String(CertificateSource.AUTOMATIC.value),
      state: String(CertificateState.SERVING.value),
      certificate_pem: material.certificatePem,
      private_key_enc: SecretService.encrypt(material.privateKeyPem),
      issuer: material.issuer,
      subject_alt_names: JSON.stringify(material.subjectAltNames),
      serial: material.serial,
      fingerprint_sha256: material.fingerprintSha256,
      not_before: material.notBefore,
      not_after: material.notAfter,
      last_error: '',
      next_attempt_at: null,
      attempts_in_window: 0,
      last_warned_days: null,
    });
    return this.find(normalized);
  }

  /**
   * An attempt that reached the authority and failed.
   *
   * THE MATERIAL IS NOT TOUCHED. `edgeBundle` selects on stored material rather than on state, so a
   * certificate that is still valid keeps being served while its renewal is failing — which is the
   * difference between a warning in the admin and every visitor seeing a security error.
   */
  async recordFailure(host: string, reason: string, attempts: number, nextAttemptAt: Date): Promise<void> {
    await this.write(CertificateStoreService.normalizeHost(host), {
      state: String(CertificateState.FAILED.value),
      last_error: String(reason ?? ''),
      last_attempt_at: new Date(),
      next_attempt_at: nextAttemptAt,
      attempts_in_window: attempts,
    });
  }

  /**
   * The host is not pointing here yet.
   *
   * `attempts_in_window` is deliberately NOT incremented: this never reached the authority, so it
   * spent none of the failure budget the counter exists to ration.
   */
  async markWaitingForDns(host: string, reason: string, nextAttemptAt: Date): Promise<void> {
    await this.write(CertificateStoreService.normalizeHost(host), {
      state: String(CertificateState.WAITING_FOR_DNS.value),
      last_error: String(reason ?? ''),
      last_attempt_at: new Date(),
      next_attempt_at: nextAttemptAt,
    });
  }

  /** Record that a warning went out at this threshold, so the same one is not sent again tomorrow. */
  async markWarned(host: string, days: number): Promise<void> {
    const normalized = CertificateStoreService.normalizeHost(host);
    if (!normalized) return;
    await this.write(normalized, { last_warned_days: days });
  }

  /**
   * Certificates and DECRYPTED keys, for whatever terminates TLS.
   *
   * The one method that hands out key material. Rows with nothing stored are left out rather than
   * sent as empty strings — a terminator must be able to tell "no certificate" from "a broken one".
   * An EXPIRED certificate IS included: it is what the operator uploaded, it is what browsers are
   * being shown, and quietly withholding it would replace a visible expiry warning with an
   * unexplained connection failure.
   */
  async edgeBundle(): Promise<Array<Record<string, unknown>>> {
    const records = await this.list();
    return records.filter((record) => record.hasMaterial).map((record) => record.toEdgeJson());
  }

  /** Insert or update by host, always stamping `updated_at`. */
  private async write(host: string, values: Record<string, unknown>): Promise<void> {
    const existing = await this.db.findOne(CertificateStoreService.TABLE, { host });
    const payload = { ...values, updated_at: new Date() };
    if (existing) {
      await this.db.update(CertificateStoreService.TABLE, { host }, payload);
      return;
    }
    await this.db.insert(CertificateStoreService.TABLE, { host, ...payload });
  }

  /**
   * A host as the table keys it: lowercase, no trailing dot, no port.
   *
   * The same normalisation `HostPermission` and the routing map apply. Two spellings of one name
   * must never become two rows, or removing a certificate would leave a second copy still serving.
   */
  private static normalizeHost(host: unknown): string {
    return String(host ?? '').trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
  }
}
