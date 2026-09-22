import type { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import type { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import type { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

/**
 * One plugin's raw inputs to the health report.
 *
 * The three axes are typed as their ENUMS, not `string` — a `state: string` here silently let the
 * report compare a raw string against an enum member, which a reactor `Enum` makes a type error.
 */
export interface IPluginHealthEntryInput {
  slug: string;
  state: PluginState;
  healthStatus?: PluginRegistryHealth;
  heldReason?: PluginHeldReason;
  error?: string;
  manifestCapabilities?: string[];
  approvedCapabilities?: string[];
  /** The version THIS PROCESS loaded, from the manifest it holds in memory. */
  runningVersion?: string;
  /** The version currently on disk. Null when it cannot be read — "cannot tell", never "changed". */
  installedVersion?: string | null;
}
