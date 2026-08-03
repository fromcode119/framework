import type { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import type { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';

/**
 * The optional first argument of a plugin route registration, declaring how the route is guarded:
 * either a coarse {@link AccessLevel} or a specific {@link ApiPermissionRequirement}.
 */
export interface IApiAccessDescriptor {
  access: AccessLevel | ApiPermissionRequirement;
}
