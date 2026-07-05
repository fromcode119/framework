import type { AccessLevel } from './api-access-gate.enums';

/**
 * Route access declaration. `ApiAccessLevel` accepts the raw {@link AccessLevel} string values
 * (`` `${AccessLevel}` ``), so existing `{ access: 'public' }` literals keep type-checking while new
 * code uses the enum.
 */
export type ApiAccessLevel = `${AccessLevel}` | { permission: string };

export type ApiAccessDescriptor = { access: ApiAccessLevel };

export type ApiPermissionCheck = (userId: number, permission: string) => Promise<boolean> | boolean;
