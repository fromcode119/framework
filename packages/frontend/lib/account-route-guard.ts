import { redirect } from 'next/navigation';
import { AccountRouteUtils, RouteConstants } from '@fromcode119/core/client';
import { ServerApiUtils } from '@/lib/server-api/server-api';

/**
 * Server-side authentication gate for the account area.
 *
 * The account shell is client-rendered and code-split, so for a long time the ONLY thing standing
 * between a signed-out visitor and the whole account was a client component. That gate lived inside
 * the framework's default shell, which meant a theme registering its own `account.shell` replaced the
 * layout and silently took the authentication with it: `/account`, `/account/orders`,
 * `/account/email-preferences` all answered 200 to a guest, painting every section name — and with
 * them the installed plugin set — with no redirect.
 *
 * The client gate still exists and still matters (it catches in-app navigation, which never reaches
 * the server, and a session that expires mid-visit). This is the layer that makes a guest never
 * receive the markup in the first place: the redirect happens before any HTML is produced, so there
 * is no chrome to flash and no layout to jump.
 *
 * Costs one API round-trip, on account paths only. The catch-all is already per-request dynamic
 * (`await connection()`), so reading the visitor's cookie here surrenders no caching.
 */
export class AccountRouteGuard {
  /** The framework's own session probe — the same endpoint the client gate treats as authoritative. */
  private static readonly SESSION_PROBE_PATH = `${RouteConstants.SEGMENTS.AUTH}${RouteConstants.SEGMENTS.ME_PERSON}`;

  /**
   * Whether a path belongs to the account area. Keyed off {@link AccountRouteUtils}, the declared
   * single source of truth for the account URL shape — never a `/account` literal, so a platform that
   * moves the account moves this gate with it.
   */
  static covers(pathname: string): boolean {
    const base = AccountRouteUtils.base().replace(/\/+$/, '');
    const path = `/${String(pathname || '').trim().replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
    return path === base || path.startsWith(`${base}/`);
  }

  /**
   * Redirect a signed-out visitor to the login page. A no-op for every path outside the account and
   * for a visitor whose session the API confirms.
   *
   * `returnTo` is the URL the visitor actually asked for (locale prefix and all), so signing in lands
   * them where they were going rather than on the account index.
   */
  static async enforce(pathname: string, returnTo: string): Promise<void> {
    if (!AccountRouteGuard.covers(pathname)) return;
    if (await AccountRouteGuard.hasSession()) return;
    // Outside any try/catch: `redirect()` signals by throwing, and swallowing that turns the gate off.
    redirect(`${RouteConstants.SEGMENTS.LOGIN}?next=${encodeURIComponent(returnTo)}`);
  }

  /**
   * Fails CLOSED. An unreachable API means the session is unknown, and "unknown" must not resolve to
   * "signed in" on the one surface whose entire job is to be private.
   */
  private static async hasSession(): Promise<boolean> {
    const outcome = await ServerApiUtils.serverFetchResponseOutcome(AccountRouteGuard.SESSION_PROBE_PATH);
    if (outcome.isUnreachable) return false;
    const response = outcome.value;
    // The probe sits behind the auth guard: a guest gets 401, so a 200 IS a session. Requiring a person
    // record as well turned away every account that has none yet — an administrator created in the
    // console, on a site where the person is not made on read — and sent them back to the login page
    // after every successful sign-in. The body must still be the probe's own answer (it always carries
    // `person`, null included) — a 200 from anything else in front of the API is not a session.
    if (!response?.ok) return false;
    const body = await response.json().catch(() => null);
    return Boolean(body && typeof body === 'object' && 'person' in body);
  }
}
