import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';
import { PluginContext } from '@core/plugin-context';

export interface IFromcodePlugin {
  manifest: IPluginManifest;
  onInstall?: (ctx: PluginContext) => Promise<void>;
  onInit?: (ctx: PluginContext) => Promise<void>;
  onUpdate?: (ctx: PluginContext, info: { oldVersion: string; newVersion: string }) => Promise<void>;
  onEnable?: (ctx: PluginContext) => Promise<void>;
  onDisable?: (ctx: PluginContext) => Promise<void>;
  onUninstall?: (ctx: PluginContext) => Promise<void>;

  // Public API exposed to other plugins
  publicAPI?: any;
}
