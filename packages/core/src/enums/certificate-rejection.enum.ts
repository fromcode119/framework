import { Enum } from '@fromcode119/react-class-components';

/**
 * Why an uploaded certificate was refused.
 *
 * Every one of these is a specific, actionable sentence rather than "invalid certificate". An
 * operator pasting a certificate at the end of a bad day needs to know WHICH of the two boxes is
 * wrong, and a generic failure sends them to re-download both from the issuer.
 *
 * The member carries the i18n KEY, never the sentence: the copy lives in the locale files like all
 * user-facing text, and the reason code is what crosses the wire.
 */
export class CertificateRejection extends Enum {
  /** The certificate box does not contain a readable PEM certificate. */
  static readonly CERTIFICATE_UNREADABLE = new CertificateRejection('certificate_unreadable', 'certificates.rejection.certificateUnreadable');

  /**
   * The key box does not contain a readable PEM private key.
   *
   * The common cause is a passphrase-protected key, which the platform cannot use: it would have to
   * hold the passphrase to serve the certificate, which is the same as not having one.
   */
  static readonly PRIVATE_KEY_UNREADABLE = new CertificateRejection('private_key_unreadable', 'certificates.rejection.privateKeyUnreadable');

  /** Both parse, but they are not a pair — almost always a key from a different order. */
  static readonly KEY_MISMATCH = new CertificateRejection('key_mismatch', 'certificates.rejection.keyMismatch');

  /** Already past its expiry date. Storing it would put a broken certificate live. */
  static readonly ALREADY_EXPIRED = new CertificateRejection('already_expired', 'certificates.rejection.alreadyExpired');

  /** Valid, but issued for other names — browsers would reject it for this host. */
  static readonly HOST_NOT_COVERED = new CertificateRejection('host_not_covered', 'certificates.rejection.hostNotCovered');

  /**
   * This installation cannot encrypt, so it must not accept a private key at all.
   *
   * Refused up front rather than at save time: the admin disables the control and says this, because
   * failing after somebody has pasted a key is both worse and later.
   */
  static readonly ENCRYPTION_UNAVAILABLE = new CertificateRejection('encryption_unavailable', 'certificates.rejection.encryptionUnavailable');

  private constructor(value: string, readonly translationKey: string) {
    super(value);
  }

  /** The member a wire value names, or null. */
  static find(value: unknown): CertificateRejection | null {
    if (value instanceof CertificateRejection) return value;
    return (CertificateRejection.fromValue(String(value ?? '').trim().toLowerCase()) as CertificateRejection | undefined) ?? null;
  }
}
