import { PluginManifest } from './manifests.interfaces';
import { PluginContext } from './plugin-context.interfaces';
import { PluginRegistryHealth, PluginHeldReason } from '../plugin/services/plugin-health.enums';
import { PluginState } from '../plugin/services/plugin-state.enums';

export interface FromcodePlugin {
  manifest: PluginManifest;
  onInstall?: (ctx: PluginContext) => Promise<void>;
  onInit?: (ctx: PluginContext) => Promise<void>;
  onUpdate?: (ctx: PluginContext, info: { oldVersion: string; newVersion: string }) => Promise<void>;
  onEnable?: (ctx: PluginContext) => Promise<void>;
  onDisable?: (ctx: PluginContext) => Promise<void>;
  onUninstall?: (ctx: PluginContext) => Promise<void>;

  // Public API exposed to other plugins
  publicAPI?: any;
}

/**
 * Represents an installed plugin at runtime, combining manifest data with system state.
 */
export interface LoadedPlugin extends FromcodePlugin {
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
