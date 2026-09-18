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

  /**
   * Is this plugin's code actually LOADED and able to answer right now?
   *
   * Absent means in-process: there is no separate thing to be down, so it is always running. An
   * ISOLATED plugin answers from its host, and is false while its guest process is starting,
   * restarting or stopped.
   *
   * A FUNCTION and not a getter, deliberately. This record is built by SPREADING the host's stubs
   * (`PluginHostRegistry`), and a spread copies a getter's value at that instant — it would freeze
   * "running" as whatever was true when the plugin was first registered and never change again. A
   * function survives the copy and is asked each time.
   */
  isRunning?: () => boolean;
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
}
