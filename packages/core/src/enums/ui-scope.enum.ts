import { Enum } from '@fromcode119/reactor';

/** Which UI surface a plugin asset/registration targets. */
export class UiScope extends Enum {
  static readonly ADMIN = new UiScope('admin');
  static readonly FRONTEND = new UiScope('frontend');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to ADMIN. */
  static resolve(value: unknown): UiScope {
    if (value instanceof UiScope) return value;
    const found = UiScope.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as UiScope | undefined) ?? UiScope.ADMIN;
  }
}
