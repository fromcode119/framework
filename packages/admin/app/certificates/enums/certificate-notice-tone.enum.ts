import { Enum } from '@fromcode119/react-class-components';

/**
 * How a certificate notice reads at a glance — the colour it is drawn in.
 *
 * `MUTED` is the one that matters and the one most easily lost: it means the platform gateway could
 * not be reached, so what is actually serving these certificates is UNKNOWN. Painting that as `GOOD`
 * would state a fact nothing measured, which is the failure this whole screen was rewritten to stop.
 */
export class CertificateNoticeTone extends Enum {
  static readonly GOOD = new CertificateNoticeTone('good');
  static readonly WARN = new CertificateNoticeTone('warn');
  static readonly BAD = new CertificateNoticeTone('bad');
  /** Not good, not bad — not known. */
  static readonly MUTED = new CertificateNoticeTone('muted');

  private constructor(value: string) {
    super(value);
  }
}
