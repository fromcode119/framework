import { RouteConstants } from '@fromcode119/core/client';

/**
 * Route predicates for the admin shell. Paths come from `RouteConstants.SEGMENTS` — never inlined as
 * literals — so a framework route rename stays a single-source change.
 */
export class AdminRouteUtils {
  /**
   * The auth surfaces a LOGGED-OUT visitor can reach (sign-in, forgot-password, reset-password).
   * These are appearance-agnostic: the workspace appearance is resolved from an auth-guarded settings
   * endpoint, so waiting on it here would leave a logged-out visitor staring at a blank screen.
   */
  private static readonly UNAUTHENTICATED_AUTH_SEGMENTS: readonly string[] = [
    RouteConstants.SEGMENTS.LOGIN,
    RouteConstants.SEGMENTS.FORGOT_PASSWORD,
    RouteConstants.SEGMENTS.RESET_PASSWORD,
  ];

  /** True when `pathname` is one of the unauthenticated auth routes (exact match or a sub-path). */
  static isUnauthenticatedAuthRoute(pathname: string): boolean {
    const path = String(pathname || '').trim();
    if (!path) return false;
    return AdminRouteUtils.UNAUTHENTICATED_AUTH_SEGMENTS.some(
      (segment) => path === segment || path.startsWith(`${segment}/`),
    );
  }
}
