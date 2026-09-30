import type { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import type { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';

/**
 * The optional first argument of a plugin route registration, declaring how the route is guarded:
 * either a coarse {@link AccessLevel} or a specific {@link ApiPermissionRequirement}.
 */
export interface IApiAccessDescriptor {
  access: AccessLevel | ApiPermissionRequirement;
  /**
   * The route's answer to an anonymous GET depends only on the site, the path, the query and the
   * locale — never on a cookie, a header or who is asking — so repeats may be served from
   * ApiResponseCache. Declare it only when that is true: a cart or anything read from a visitor's
   * cookie must not.
   */
  anonymousCache?: boolean;
}
