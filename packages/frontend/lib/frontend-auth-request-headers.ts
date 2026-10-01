import { BrowserStateClient, CookieConstants } from '@fromcode119/core/client';

/**
 * Headers for the default sign-up, verification and password pages' JSON posts.
 *
 * The api refuses every cookie-carrying write that does not echo the `fc_csrf` cookie back in
 * `X-CSRF-Token` (double submit). These pages post with a bare `fetch`, not the runtime's api client
 * that adds it, so without this every registration, password reset and email verification on a site
 * using the default pages was answered 403 "Invalid CSRF token".
 */
export class FrontendAuthRequestHeaders {
  private static readonly browserState = new BrowserStateClient();

  static json(extra: Record<string, string> = {}): Record<string, string> {
    const csrfToken = FrontendAuthRequestHeaders.browserState.readCookie(CookieConstants.AUTH_CSRF);
    return {
      'Content-Type': 'application/json',
      'X-Framework-Client': 'frontend-ui',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...extra,
    };
  }
}
