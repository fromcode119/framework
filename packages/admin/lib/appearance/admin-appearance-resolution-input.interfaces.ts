/**
 * Pure inputs to AdminAppearanceResolver.resolveAppearanceId. Precedence is tenant → deployment →
 * built-in default. A candidate id that is not present in `registeredIds` is skipped and
 * resolution falls through to the default.
 */
export interface AdminAppearanceResolutionInput {
  /** Per-tenant override (runtime, e.g. the system setting `admin_appearance`). */
  readonly tenantAppearanceId?: string | null;
  /** Per-deployment default (e.g. AppEnv.ADMIN_APPEARANCE). */
  readonly deploymentAppearanceId?: string | null;
  /** Ids currently registered in the appearance registry. */
  readonly registeredIds: readonly string[];
}
