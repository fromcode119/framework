import { Enum } from '@fromcode119/react-class-components';

/** Where the confirm-your-email page is: no link token, confirming it, confirmed, or refused. */
export class AuthVerifyStatus extends Enum {
  static readonly NO_TOKEN = new AuthVerifyStatus('noToken');
  static readonly VERIFYING = new AuthVerifyStatus('verifying');
  static readonly VERIFIED = new AuthVerifyStatus('verified');
  static readonly FAILED = new AuthVerifyStatus('failed');

  private constructor(value: string) {
    super(value);
  }

  /** A new link may be requested only when there was none or the one used was refused. */
  get offersResend(): boolean {
    return this === AuthVerifyStatus.NO_TOKEN || this === AuthVerifyStatus.FAILED;
  }
}
