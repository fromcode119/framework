import type { FromcodePlugin } from './types';

/**
 * Utility for defining Fromcode plugins with proper type inference.
 */
export class PluginDefinitionUtils {
  static define(plugin: FromcodePlugin): FromcodePlugin {
    return plugin;
  }
}
