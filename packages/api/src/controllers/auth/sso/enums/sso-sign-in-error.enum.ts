import { Enum } from '@fromcode119/react-class-components';

/**
 * Why a social sign-in was refused. The value is the code the storefront receives (`?ssoError=<code>`
 * after a redirect, `error` in a JSON answer) and translates; the status is what a JSON caller gets.
 */
export class SsoSignInError extends Enum {
  /** The provider is not switched on in Settings → Integrations → Federated Login. */
  static readonly NOT_ENABLED = new SsoSignInError('not_enabled', 400);
  /** Switched on, but without the client ID or secret a redirect sign-in needs. */
  static readonly NOT_CONFIGURED = new SsoSignInError('not_configured', 400);
  /** The round trip's `state` did not match the one this browser started, or it expired. */
  static readonly INVALID_STATE = new SsoSignInError('invalid_state', 400);
  /** The visitor cancelled at the provider, or the provider refused the code exchange. */
  static readonly PROVIDER = new SsoSignInError('provider_error', 400);
  /** The provider did not vouch for the email address, so it cannot name an account here. */
  static readonly UNVERIFIED_EMAIL = new SsoSignInError('unverified_email', 403);
  /** No account uses this email and the site does not accept new registrations. */
  static readonly REGISTRATION_CLOSED = new SsoSignInError('registration_closed', 403);
  static readonly ACCOUNT_INACTIVE = new SsoSignInError('account_inactive', 403);
  /** The account uses two-step verification, which a redirect sign-in cannot ask for. */
  static readonly TWO_FACTOR = new SsoSignInError('two_factor_required', 403);
  /** Signing in is switched off on this storefront. */
  static readonly SIGN_IN_DISABLED = new SsoSignInError('sign_in_disabled', 404);
  /** The account has no membership on the workspace host it signed in on. */
  static readonly WORKSPACE_DENIED = new SsoSignInError('workspace_denied', 403);

  private constructor(value: string, readonly status: number) {
    super(value);
  }
}
