import { Enum } from '@fromcode119/reactor';

/** Whether the account auth gate has resolved a session. */
export class AuthGateState extends Enum {
  static readonly CHECKING = new AuthGateState('checking');
  static readonly AUTHED = new AuthGateState('authed');
  static readonly GUEST = new AuthGateState('guest');

  private constructor(value: string) {
    super(value);
  }
}
