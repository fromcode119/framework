import { PluginInstalledVersionService } from '@fromcode119/core';
import type { ILoadedPlugin } from '@fromcode119/core/interfaces/loaded-plugin.interface';
import type { IPluginHealthEntryInput } from '@fromcode119/core/plugin/services/interfaces/plugin-health-entry-input.interface';

/**
 * Turns a loaded plugin into the health report's input shape.
 *
 * Lives beside `plugin-archive-support` and `plugin-settings-support` for the same reason they do:
 * the controller is a router, and the mapping is the part with the reasoning in it.
 */
export class PluginHealthSupport {
  static toHealthInput(plugin: ILoadedPlugin): IPluginHealthEntryInput {
    return {
      slug: plugin.manifest.slug,
      state: plugin.state,
      healthStatus: plugin.healthStatus,
      heldReason: plugin.heldReason,
      error: plugin.error,
      manifestCapabilities: (plugin.manifest.capabilities as string[]) || [],
      approvedCapabilities: plugin.approvedCapabilities || [],
      // What this process loaded, against what is sitting next to the code right now. These drift
      // whenever a plugin is installed under a running api, and nothing else on this screen would
      // say so — the `version` field reports the manifest held in memory, which is the one being
      // served and therefore always agrees with itself.
      runningVersion: plugin.manifest.version as string,
      installedVersion: PluginInstalledVersionService.onDisk(plugin.path),
    };
  }
}
