import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHY the first-run setup window is closed, in the words the operator needs.
 *
 * The two are not interchangeable on screen: `COMPLETED` means somebody already set this platform up
 * and the answer is to sign in; `EXPIRED` means the window ran out and the answer is to restart the
 * process. Telling an operator the wrong one sends them down the wrong path entirely.
 *
 * `null` — not a member — is the third answer: setup is open.
 */
export class SetupUnavailableReason extends Enum {
  /** Already set up. */
  static readonly COMPLETED = new SetupUnavailableReason('completed');

  /** The window closed before anyone claimed it. */
  static readonly EXPIRED = new SetupUnavailableReason('expired');

  private constructor(value: string) {
    super(value);
  }
}
