import { Enum } from '@fromcode119/react-class-components';

/** Whether an account may sign in — the API's `accountStatus`, as the admin reads it. */
export class AccountStatus extends Enum {
  static readonly ACTIVE = new AccountStatus('active');
  static readonly SUSPENDED = new AccountStatus('suspended');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a stored string to a member; an account with no status is ACTIVE, as the API treats it. */
  static resolve(value: unknown): AccountStatus {
    if (value instanceof AccountStatus) return value;
    const found = AccountStatus.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as AccountStatus | undefined) ?? AccountStatus.ACTIVE;
  }
}
