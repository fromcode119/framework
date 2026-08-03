import { Enum } from '@fromcode119/reactor';

/**
 * Which second factor a login challenge uses.
 *
 * Owned by core because BOTH sides need the same class: the api issues the challenge and the admin login
 * form answers it. It previously existed twice (admin + api) with no `resolve()` — and the value crosses
 * the wire as JSON, so `method === TwoFactorMethod.TOTP` on a raw string was always false.
 */
export class TwoFactorMethod extends Enum {
  static readonly TOTP = new TwoFactorMethod('totp');
  static readonly RECOVERY = new TwoFactorMethod('recovery');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw value to a member; defaults to TOTP. */
  static resolve(value: unknown): TwoFactorMethod {
    if (value instanceof TwoFactorMethod) return value;
    const found = TwoFactorMethod.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as TwoFactorMethod | undefined) ?? TwoFactorMethod.TOTP;
  }
}
