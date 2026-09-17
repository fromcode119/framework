import { RouteEndpointSegments } from '@core/constants/route-endpoint-segments.constants';
import { RouteMountSegments } from '@core/constants/route-mount-segments.constants';
import { RouteAuthSegments } from '@core/constants/route-auth-segments.constants';
/**
 * Centralized route segment constants for core framework routes.
 * Use these instead of hardcoding strings in routers.
 * 
 * Plugin-specific routes should be defined in their respective plugin directories.
 */
export class RouteConstants {
  /**
   * Every route segment the framework knows, recombined from the two halves it is declared in.
   *
   * See {@link RouteMountSegments}, {@link RouteAuthSegments} and {@link RouteEndpointSegments}. The
   * spread preserves literal
   * types because both halves are `as const`.
   */
  static readonly SEGMENTS = {
    ...RouteMountSegments.ALL,
    ...RouteAuthSegments.ALL,
    ...RouteEndpointSegments.ALL,
  } as const;

  /**
   * The auth routes that carry NO `auth.guard()` — the ones a visitor with no session, or a session
   * the server will not accept, must still be able to reach.
   *
   * They read no tenant rows, so admin tenancy has nothing to decide for them, and refusing them on
   * a tenancy verdict locks an operator out of the only screens that could fix the session. That is
   * not hypothetical: on a workspace domain, an account holding a valid session but no membership
   * there had EVERY admin-client request answered `403 tenant_access_revoked` — including `/login`,
   * so it could not sign in as somebody else, and `/host`, so the console could not even find out
   * whose domain it was standing on.
   *
   * Kept in step with `AuthRouter.registerRoutes` by `auth-public-segments.test.ts`, which fails if a
   * route here is guarded or a guardless route is missing from this list.
   */
  static readonly AUTH_PUBLIC_SEGMENTS: readonly string[] = [
    RouteConstants.SEGMENTS.STATUS,
    RouteConstants.SEGMENTS.SETUP,
    RouteConstants.SEGMENTS.REGISTER,
    RouteConstants.SEGMENTS.VERIFY_EMAIL,
    RouteConstants.SEGMENTS.RESEND_VERIFICATION,
    RouteConstants.SEGMENTS.FORGOT_PASSWORD,
    RouteConstants.SEGMENTS.RESET_PASSWORD,
    RouteConstants.SEGMENTS.SSO_PROVIDERS,
    RouteConstants.SEGMENTS.SSO_LOGIN,
    RouteConstants.SEGMENTS.LOGIN,
    RouteConstants.SEGMENTS.LOGOUT,
    RouteConstants.SEGMENTS.HOST_INFO,
    RouteConstants.SEGMENTS.EMAIL_CHANGE_CONFIRM,
  ];
}
