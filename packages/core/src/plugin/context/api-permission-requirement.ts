/**
 * A route that requires one specific permission rather than a coarse {@link AccessLevel}:
 * `context.api.post('/payouts', { access: new ApiPermissionRequirement('finance:payout') }, handler)`.
 *
 * Admins always pass, so this narrows access WITHIN the admin tier rather than replacing it.
 *
 * A class, not a `{ permission: string }` object literal: the gate distinguishes the two access forms
 * with `instanceof` instead of a `typeof level === 'object'` probe.
 */
export class ApiPermissionRequirement {
  constructor(readonly permission: string) {}
}
