import { Enum } from '@fromcode119/react-class-components';

/** Whether the account auth gate has resolved a session. */
export class AuthGateState extends Enum {
  static readonly CHECKING = new AuthGateState('checking');
  static readonly AUTHED = new AuthGateState('authed');
  static readonly GUEST = new AuthGateState('guest');
  /** The session could not be checked (rate limited, server or network error) — not a guest. */
  static readonly UNAVAILABLE = new AuthGateState('unavailable');

  private constructor(value: string) {
    super(value);
  }
}
