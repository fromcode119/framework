import { Enum } from '@fromcode119/reactor';

/**
 * Persisted runtime health of an INSTALLED plugin (the `_system_plugins.health_status` column).
 *
 * This is the axis ORTHOGONAL to the activation `state`: `state` is the operator's intent (see
 * `PluginState`), `healthStatus` is how the plugin is actually doing. A capability-drift hold is
 * expressed as WARNING (+ a `PluginHeldReason`) rather than a new `state` value, so the ~15
 * `state === PluginState.ACTIVE` gates stay untouched.
 *
 * Distinct from `PluginHealthStatus` (ok|degraded|error), which is a plugin health-CHECK response.
 */
export class PluginRegistryHealth extends Enum {
  static readonly HEALTHY = new PluginRegistryHealth('healthy');
  static readonly WARNING = new PluginRegistryHealth('warning');
  static readonly ERROR = new PluginRegistryHealth('error');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a persisted/raw value to a member, or `undefined` when the column is empty. */
  static resolve(value: unknown): PluginRegistryHealth | undefined {
    if (value instanceof PluginRegistryHealth) return value;
    return PluginRegistryHealth.fromValue(String(value ?? '').trim().toLowerCase()) as PluginRegistryHealth | undefined;
  }
}
