import { Enum } from '@fromcode119/react-class-components';

/**
 * What is true about a host's certificate right now.
 *
 * SOME OF THESE ARE STORED AND SOME ARE DERIVED, deliberately. A stored state answers "what happened
 * last time we tried" — nobody can work that out by looking at the certificate. The expiry states
 * answer "where are we in this certificate's life", which is a pure function of `not_after` and the
 * clock, and storing that would mean a row whose state is a lie the moment midnight passes. A
 * certificate that expired an hour ago must not still read SERVING because no sweep has run yet.
 *
 * So `isStored` members go in the column, and `CertificateRecord.state` overlays the rest at read
 * time. Nothing writes EXPIRED; it becomes true on its own.
 *
 * Compare against `.value` — the column holds a raw string, and an Enum tested against a string is
 * always false.
 */
export class CertificateState extends Enum {
  /** No certificate for this host. Nothing can serve it over HTTPS. */
  static readonly NO_CERTIFICATE = new CertificateState('no_certificate', true, 'neutral');

  /**
   * The domain does not point here yet, so asking for a certificate would only fail.
   *
   * DECLARED FOR THE NEXT SLICE — only the automatic path can reach it. It exists now so the column
   * and the admin's state list do not change when issuing lands.
   */
  static readonly WAITING_FOR_DNS = new CertificateState('waiting_for_dns', true, 'warn');

  /** An order is in flight. Next slice; unreachable today. */
  static readonly ISSUING = new CertificateState('issuing', true, 'neutral');

  /** A valid certificate is stored and being served. */
  static readonly SERVING = new CertificateState('serving', true, 'good');

  /** The last attempt failed. `last_error` says why, verbatim. */
  static readonly FAILED = new CertificateState('failed', true, 'danger');

  /**
   * Inside the renewal window, and the platform will renew it. Derived, and only ever for a source
   * the platform manages — an uploaded certificate reads EXPIRING instead, because nothing here is
   * going to renew it and calling it "renewal due" would imply otherwise.
   */
  static readonly RENEWAL_DUE = new CertificateState('renewal_due', false, 'warn');

  /** Expires soon and NOTHING will renew it on its own. A human has to act. Derived. */
  static readonly EXPIRING = new CertificateState('expiring', false, 'warn');

  /** Already past `not_after`. Still served, loudly. Derived. */
  static readonly EXPIRED = new CertificateState('expired', false, 'danger');

  private constructor(value: string, readonly isStored: boolean, readonly tone: string) {
    super(value);
  }

  /** The member a stored value names, or null. Never defaults — an unknown state is not "fine". */
  static find(value: unknown): CertificateState | null {
    if (value instanceof CertificateState) return value;
    return (CertificateState.fromValue(String(value ?? '').trim().toLowerCase()) as CertificateState | undefined) ?? null;
  }

  /** Whether this state means a certificate is actually on the wire for the host. */
  get isServing(): boolean {
    return this === CertificateState.SERVING
      || this === CertificateState.RENEWAL_DUE
      || this === CertificateState.EXPIRING
      || this === CertificateState.EXPIRED;
  }

  /** Whether the operator needs to do something. Drives the admin's attention, nothing else. */
  get needsAttention(): boolean {
    return this.tone !== 'good' && this !== CertificateState.NO_CERTIFICATE && this !== CertificateState.ISSUING;
  }
}
