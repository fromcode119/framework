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
  sandbox?: boolean | { memoryLimit?: number; timeout?: number; allowNative?: boolean; enabled?: boolean };
}
