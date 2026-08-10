import { RouteConstants } from '@fromcode119/core/client';
import { AccountEmailPreferencesPanel } from '@react/account/email-preferences-panel';

/**
 * The same preferences screen for someone who arrived from a link in an email instead of a session.
 *
 * Most recipients have no account, so the account panel cannot be the only way to change what you
 * receive. The signed token in the URL is the credential, exactly as it is on every unsubscribe link
 * the platform issues, and it is the ONLY thing that names the address — the endpoints ignore an
 * address supplied by the caller.
 *
 * Four hooks differ from the account panel; everything else — the toggle rows, the optimistic update,
 * the transactional-mail note — is inherited. It also inherits `accountSection`, which is harmless:
 * account panels are registered from an explicit list in `AccountSectionRegistry`, never discovered by
 * looking for that static, so nothing registers this as a second copy of the account screen.
 */
export class TokenEmailPreferencesPanel extends AccountEmailPreferencesPanel {
  /**
   * Read at call time rather than on mount, because this component is server-rendered first and
   * `window` does not exist during that pass — a field initialised at construction would be frozen
   * empty into the markup.
   */
  private get token(): string {
    if (typeof window === 'undefined') return '';
    return String(new URLSearchParams(window.location.search).get('token') || '').trim();
  }

  protected get preferencesPath(): string {
    return `${RouteConstants.SEGMENTS.EMAIL_PREFERENCES_BY_TOKEN}?token=${encodeURIComponent(this.token)}`;
  }

  protected get updatePath(): string {
    return RouteConstants.SEGMENTS.EMAIL_PREFERENCES_BY_TOKEN;
  }

  protected buildUpdateBody(key: string, subscribed: boolean): Record<string, unknown> {
    return { token: this.token, key, subscribed };
  }

  /**
   * A translated sentence, never the exception.
   *
   * The account panel can afford to surface a raw message to someone already signed in. This page is
   * customer-facing, and `String(error.message)` there means an HTTP status or a stack fragment lands
   * in front of a member of the public in the wrong language.
   */
  protected describeError(): string {
    return this.t(
      'account.emailPreferences.linkInvalid',
      {},
      'This link is no longer valid. It may have expired, or it may be incomplete — please open the most recent email we sent you.',
    );
  }
}
