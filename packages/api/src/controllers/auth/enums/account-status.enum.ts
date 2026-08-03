import { Enum } from '@fromcode119/reactor';

/** Whether an account may authenticate. Persisted as its `.value`. */
export class AccountStatus extends Enum {
  static readonly ACTIVE = new AccountStatus('active');
  static readonly SUSPENDED = new AccountStatus('suspended');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a stored string to a member; defaults to ACTIVE. */
  static resolve(value: unknown): AccountStatus {
    if (value instanceof AccountStatus) return value;
    const found = AccountStatus.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as AccountStatus | undefined) ?? AccountStatus.ACTIVE;
  }
}
