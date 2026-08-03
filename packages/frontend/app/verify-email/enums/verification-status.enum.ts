import { Enum } from '@fromcode119/reactor';

/** State of an email-verification / resend action. */
export class VerificationStatus extends Enum {
  static readonly IDLE = new VerificationStatus('idle');
  static readonly VERIFYING = new VerificationStatus('verifying');
  static readonly SUCCESS = new VerificationStatus('success');
  static readonly ERROR = new VerificationStatus('error');

  private constructor(value: string) {
    super(value);
  }
}
