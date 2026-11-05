import type { AuthErrorCode } from '@api/controllers/auth/enums/auth-error-code.enum';

/** One password rule the operator set that a submitted password breaks. */
export class PasswordPolicyViolation {
  constructor(
    readonly code: AuthErrorCode,
    readonly message: string,
    readonly params?: Record<string, string | number>,
  ) {}

  /** The 400 body every password-setting endpoint sends. */
  body(): Record<string, unknown> {
    return this.code.body(this.message, this.params);
  }
}
