import { Enum } from '@fromcode119/react-class-components';

/**
 * Why a storefront sign-in, registration, verification or password-reset request was refused.
 *
 * Sent as `code` next to the English `error` text, so a sign-in screen can show the reason in the
 * site's own language instead of the server's wording. The value is the translation key suffix the
 * screens look up (`auth.errors.<value>`); the English `error` stays for API clients and logs.
 */
export class AuthErrorCode extends Enum {
  static readonly ALREADY_SIGNED_IN = new AuthErrorCode('alreadySignedIn');
  static readonly EMAIL_REQUIRED = new AuthErrorCode('emailRequired');
  static readonly CREDENTIALS_REQUIRED = new AuthErrorCode('credentialsRequired');
  static readonly EMAIL_TAKEN = new AuthErrorCode('emailTaken');
  static readonly INVALID_CREDENTIALS = new AuthErrorCode('invalidCredentials');
  static readonly ACCOUNT_SUSPENDED = new AuthErrorCode('accountSuspended');
  static readonly EMAIL_NOT_VERIFIED = new AuthErrorCode('emailNotVerified');
  static readonly PASSWORD_RESET_REQUIRED = new AuthErrorCode('passwordResetRequired');
  static readonly TOO_MANY_ATTEMPTS = new AuthErrorCode('tooManyAttempts');
  static readonly CAPTCHA_REQUIRED = new AuthErrorCode('captchaRequired');
  static readonly CAPTCHA_FAILED = new AuthErrorCode('captchaFailed');
  static readonly INVALID_TWO_FACTOR = new AuthErrorCode('invalidTwoFactor');
  static readonly TOKEN_REQUIRED = new AuthErrorCode('tokenRequired');
  static readonly TOKEN_EXPIRED = new AuthErrorCode('tokenExpired');
  static readonly TOKEN_INVALID = new AuthErrorCode('tokenInvalid');
  static readonly EMAIL_SEND_FAILED = new AuthErrorCode('emailSendFailed');
  static readonly SERVER_ERROR = new AuthErrorCode('serverError');
  static readonly PASSWORD_TOO_SHORT = new AuthErrorCode('passwordTooShort');
  static readonly PASSWORD_NEEDS_UPPERCASE = new AuthErrorCode('passwordNeedsUppercase');
  static readonly PASSWORD_NEEDS_LOWERCASE = new AuthErrorCode('passwordNeedsLowercase');
  static readonly PASSWORD_NEEDS_NUMBER = new AuthErrorCode('passwordNeedsNumber');
  static readonly PASSWORD_NEEDS_SYMBOL = new AuthErrorCode('passwordNeedsSymbol');
  static readonly PASSWORD_CONTAINS_EMAIL = new AuthErrorCode('passwordContainsEmail');
  static readonly PASSWORD_SAME_AS_CURRENT = new AuthErrorCode('passwordSameAsCurrent');
  static readonly PASSWORD_RECENTLY_USED = new AuthErrorCode('passwordRecentlyUsed');
  static readonly PASSWORD_BREACHED = new AuthErrorCode('passwordBreached');

  private constructor(value: string) {
    super(value);
  }

  /** The response body for this refusal: English text for API clients, the code for the screens. */
  body(message: string, params?: Record<string, string | number>, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { ...extra, error: message, code: this.value, ...(params ? { params } : {}) };
  }
}
