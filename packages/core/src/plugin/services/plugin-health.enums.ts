// ─── Companion enums file for the plugin health axis ─────────────────────────

/**
 * Persisted runtime health of an INSTALLED plugin (the `_system_plugins.health_status` column).
 * Distinct from `PluginHealthStatus` (ok|degraded|error), which is a plugin health-CHECK response.
 * Runtime health of an installed plugin. This is the axis ORTHOGONAL to the activation `state`:
 * `state` is the operator's intent (see `PluginState`), `healthStatus` is how the plugin is actually
 * doing. A capability-drift hold is expressed as WARNING (+ a `PluginHeldReason`) rather than a new
 * `state` value, so the ~15 `state === PluginState.ACTIVE` gates stay untouched.
 */
export enum PluginRegistryHealth {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Machine-readable reason a plugin is HELD (inactive + WARNING) — i.e. why it isn't running, so the
 * operator sees a real cause instead of what looks like a deliberate disable.
 */
export enum PluginHeldReason {
  /** The manifest's capabilities differ from the approved set; an admin must re-approve. */
  CAPABILITY_DRIFT = 'capability_drift',
}

/**
 * Which bucket a plugin falls into in the health report. Derived from state + health; `HELD` is the
 * capability-drift/needs-re-approval case that is otherwise invisible as a plain INACTIVE.
 */
export enum PluginHealthBucket {
  ACTIVE = 'active',
  HELD = 'held',
  ERROR = 'error',
  INACTIVE = 'inactive',
}
