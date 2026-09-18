import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';

/**
 * Represents an installed plugin at runtime, combining manifest data with system state.
 */
export interface ILoadedPlugin extends IFromcodePlugin {
  instanceId: string;
  state: PluginState;
  path?: string; // Absolute path to the plugin folder
  approvedCapabilities?: string[];
  error?: string; // Error message when state is PluginState.ERROR
  isSandboxed?: boolean;
  entryPath?: string;
  healthStatus?: PluginRegistryHealth;
  /** When health is WARNING, the machine-readable reason the plugin is held. */
  heldReason?: PluginHeldReason;
  iconUrl?: string; // Resolved absolute URL for the plugin icon
  // Runtime-populated fields from API/management
  config?: Record<string, any>;
  sandbox?: boolean | { memoryLimit?: number; timeout?: number; allowNative?: boolean; enabled?: boolean; reason?: string };
  /**
   * Is this plugin's runtime actually up right now? Absent means in-process, which is always running.
   * An isolated plugin sets this to report its guest process's live state.
   *
   * MUST be a function-valued property, never a getter. `PluginHostRegistry.describe` and the
   * directory scanner both spread a loaded-plugin record (`{ ...host.stubs(), manifest }`, then
   * `{ ...pluginModule, manifest: effectiveManifest, ... }`) on the way into `manager.plugins`; a
   * getter would be evaluated once at spread time and flattened into a stale boolean snapshot, so
   * later checks would keep reading the state from the moment the plugin was registered, not now. A
   * function value survives every spread unchanged and is only called when the check happens.
   */
  isRunning?: () => boolean;
}
