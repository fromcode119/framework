import { CertificateSource } from '@core/enums/certificate-source.enum';
import { CertificateState } from '@core/enums/certificate-state.enum';
import { SecretService } from '@core/security/secret-service';

/**
 * One host's certificate, as the platform holds it.
 *
 * TWO PROJECTIONS, NAMED DIFFERENTLY ON PURPOSE. `toAdminJson()` can never contain the private key
 * and `toEdgeJson()` always does, so "which code paths can leak a key" is a grep for one method name
 * rather than a reading of every route. Nothing else on this class exposes the key, and no accessor
 * returns it implicitly.
 *
 * The stored `state` column answers only what HAPPENED — served, failed, never had one. Where the
 * certificate is in its life is derived from `not_after` and the clock every time it is read,
 * because a stored "serving" becomes a lie the moment a certificate expires and no sweep has run.
 */
export class CertificateRecord {
  /**
   * When the platform starts saying a certificate is running out.
   *
   * These are also the days a warning is sent on. NOT operator-configurable yet — the admin states
   * the schedule so it is at least visible, and making it a declared setting belongs with the other
   * certificate settings in the next slice.
   */
  static readonly WARNING_DAYS: readonly number[] = [30, 14, 7, 1];
  private static readonly DAY_MS = 86_400_000;

  private constructor(
    readonly host: string,
    readonly tenantId: string | null,
    readonly source: CertificateSource,
    readonly storedState: CertificateState,
    readonly certificatePem: string,
    private readonly privateKeyEnc: string,
    readonly issuer: string,
    readonly subjectAltNames: readonly string[],
    readonly serial: string,
    readonly fingerprintSha256: string,
    readonly notBefore: Date | null,
    readonly notAfter: Date | null,
    readonly lastError: string,
    readonly lastAttemptAt: Date | null,
    readonly nextAttemptAt: Date | null,
    readonly attemptsInWindow: number,
    readonly lastWarnedDays: number | null,
    readonly updatedAt: Date | null,
  ) {}

  /** Hydrate a raw system-table row. System tables are read through the raw manager, so snake_case. */
  static from(row: Record<string, any>): CertificateRecord {
    return new CertificateRecord(
      String(row?.host ?? '').trim().toLowerCase(),
      row?.tenant_id ? String(row.tenant_id) : null,
      CertificateSource.find(row?.source) ?? CertificateSource.UPLOADED,
      CertificateState.find(row?.state) ?? CertificateState.NO_CERTIFICATE,
      String(row?.certificate_pem ?? '').trim(),
      // Trimmed because `SecretService.decrypt` returns anything not starting with its prefix
      // UNCHANGED: one stray newline on a hand-edited row would hand the ciphertext to the TLS
      // terminator as if it were the key, and the only symptom is handshakes failing for no visible
      // reason. The upload path never produces whitespace; a row somebody edited by hand can.
      String(row?.private_key_enc ?? '').trim(),
      String(row?.issuer ?? ''),
      CertificateRecord.readNames(row?.subject_alt_names),
      String(row?.serial ?? ''),
      String(row?.fingerprint_sha256 ?? ''),
      CertificateRecord.readDate(row?.not_before),
      CertificateRecord.readDate(row?.not_after),
      String(row?.last_error ?? ''),
      CertificateRecord.readDate(row?.last_attempt_at),
      CertificateRecord.readDate(row?.next_attempt_at),
      Number.parseInt(String(row?.attempts_in_window ?? 0), 10) || 0,
      row?.last_warned_days === null || row?.last_warned_days === undefined ? null : Number(row.last_warned_days),
      CertificateRecord.readDate(row?.updated_at),
    );
  }

  /**
   * Where this certificate is in its life, right now.
   *
   * Only a stored SERVING is overlaid: a row that failed, or never had a certificate, says so
   * regardless of dates, because a `not_after` left over from a previous certificate must not make a
   * failed renewal look merely "expiring".
   */
  get state(): CertificateState {
    if (this.storedState !== CertificateState.SERVING) return this.storedState;
    if (!this.notAfter) return this.storedState;
    if (this.notAfter.getTime() <= Date.now()) return CertificateState.EXPIRED;
    const remaining = this.daysRemaining;
    if (remaining !== null && remaining <= CertificateRecord.WARNING_DAYS[0]) {
      return this.source.isPlatformManaged ? CertificateState.RENEWAL_DUE : CertificateState.EXPIRING;
    }
    return CertificateState.SERVING;
  }

  /**
   * Whole days until expiry; negative once past, null when there is no certificate.
   *
   * Floored, so "0 days" means it goes today rather than "some time in the next 24 hours" — the
   * admin shows this number and rounding it up would promise a day that is not there.
   */
  get daysRemaining(): number | null {
    if (!this.notAfter) return null;
    return Math.floor((this.notAfter.getTime() - Date.now()) / CertificateRecord.DAY_MS);
  }

  /** Whether there is actually a certificate and key stored for this host. */
  get hasMaterial(): boolean {
    return this.certificatePem.length > 0 && this.privateKeyEnc.length > 0;
  }

  /** The warning threshold that applies now, or null when none is due. */
  get dueWarningDays(): number | null {
    const remaining = this.daysRemaining;
    if (remaining === null || !this.hasMaterial) return null;
    if (remaining < 0) return 0;
    const reached = CertificateRecord.WARNING_DAYS.filter((days) => remaining <= days);
    return reached.length ? Math.min(...reached) : null;
  }

  /**
   * Everything the admin may see. NEVER the private key.
   *
   * The certificate chain is public by nature (every visitor is handed it), so it is included for
   * the operator to inspect; the key is not here and cannot be added by a caller.
   */
  toAdminJson(): Record<string, unknown> {
    return {
      host: this.host,
      tenantId: this.tenantId,
      source: this.source.value,
      state: this.state.value,
      storedState: this.storedState.value,
      tone: this.state.tone,
      hasMaterial: this.hasMaterial,
      issuer: this.issuer,
      subjectAltNames: [...this.subjectAltNames],
      serial: this.serial,
      fingerprintSha256: this.fingerprintSha256,
      notBefore: this.notBefore?.toISOString() ?? null,
      notAfter: this.notAfter?.toISOString() ?? null,
      daysRemaining: this.daysRemaining,
      lastError: this.lastError,
      lastAttemptAt: this.lastAttemptAt?.toISOString() ?? null,
      nextAttemptAt: this.nextAttemptAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }

  /**
   * What the thing terminating TLS needs, and nothing else: the chain and the decrypted key.
   *
   * The ONE place a private key leaves the store in usable form. It is reached only by the
   * secret-gated internal endpoint, which must never be published through the edge.
   */
  toEdgeJson(): Record<string, unknown> {
    return {
      host: this.host,
      certificatePem: this.certificatePem,
      privateKeyPem: SecretService.decrypt(this.privateKeyEnc),
      notAfter: this.notAfter?.toISOString() ?? null,
    };
  }

  private static readNames(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map((name) => String(name).toLowerCase());
    const text = String(raw ?? '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.map((name) => String(name).toLowerCase()) : [];
    } catch {
      return [];
    }
  }

  private static readDate(raw: unknown): Date | null {
    if (!raw) return null;
    const parsed = raw instanceof Date ? raw : new Date(String(raw));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
