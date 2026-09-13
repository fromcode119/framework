import { Enum } from '@fromcode119/react-class-components';

/**
 * Where a host's certificate came from, and therefore who is responsible for replacing it.
 *
 * This is the one field that decides whether the platform may touch a certificate at all. An
 * operator who bought a certificate did so for a reason — an extended-validation seal, a wildcard
 * they use elsewhere, a compliance requirement naming an issuer — and the platform silently
 * replacing it with a free one would undo that decision without anyone seeing it happen.
 *
 * So the rule is: the platform renews what it issued, and never touches what it was given. An
 * UPLOADED certificate that expires is served expired and shouted about, because the alternative is
 * swapping a customer's paid certificate for a different one behind their back.
 *
 * Compare against `.value` — the column holds a raw string, and an Enum tested against a string is
 * always false.
 */
export class CertificateSource extends Enum {
  /**
   * The platform obtains and renews it.
   *
   * DECLARED HERE BUT NOT IMPLEMENTED YET. The issuing machinery is the next slice; this member
   * exists so the column, the admin filter and the stored rows do not have to change when it lands.
   * Until then `isImplemented` is false and the admin says so rather than offering a dead control.
   */
  static readonly AUTOMATIC = new CertificateSource('automatic', false);

  /** An operator pasted a certificate and its key. Nothing renews it; the platform only warns. */
  static readonly UPLOADED = new CertificateSource('uploaded', true);

  private constructor(value: string, readonly isImplemented: boolean) {
    super(value);
  }

  /**
   * The member a stored or wire value names, or null when it names none.
   *
   * `find`, never a defaulting `resolve`: guessing a source would decide whether the platform may
   * overwrite somebody's paid certificate, and no default is a safe answer to that.
   */
  static find(value: unknown): CertificateSource | null {
    if (value instanceof CertificateSource) return value;
    return (CertificateSource.fromValue(String(value ?? '').trim().toLowerCase()) as CertificateSource | undefined) ?? null;
  }

  /** Whether the platform may replace this certificate on its own. Only ever true for what it issued. */
  get isPlatformManaged(): boolean {
    return this === CertificateSource.AUTOMATIC;
  }
}
