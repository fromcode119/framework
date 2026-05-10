import type { FromcodePlugin } from './types';

export class PluginDefinitionUtils {
  /**
   * @deprecated Define plugins directly as `FromcodePlugin` objects — no wrapper needed.
   */
  static define(plugin: FromcodePlugin): FromcodePlugin {
    return plugin;
  }
}
