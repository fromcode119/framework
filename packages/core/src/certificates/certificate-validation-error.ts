import { CertificateRejection } from '@core/enums/certificate-rejection.enum';

/**
 * An upload the platform refused, carrying WHICH refusal so the admin can say something useful.
 *
 * The `message` is for logs and is deliberately free of key material; the `reason` is what the API
 * returns and the admin translates. Nothing here ever embeds the pasted key or certificate — an
 * error string is the easiest way for a private key to end up in a log file forever.
 */
export class CertificateValidationError extends Error {
  constructor(readonly reason: CertificateRejection, detail?: string) {
    super(detail ? `${reason.value}: ${detail}` : String(reason.value));
    this.name = 'CertificateValidationError';
  }
}
