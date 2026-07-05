import type { FromcodePlugin } from './types';
import type { PluginManifest } from './types';

/** The define() input: a plugin definition whose `manifest` is OPTIONAL — most plugins ship their manifest
 *  as a separate `manifest.json` and pass only lifecycle hooks + publicAPI here; only inline-manifest
 *  plugins (numerology, build-server) provide `manifest`. Keeps `FromcodePlugin`/`LoadedPlugin` (which
 *  always have a resolved manifest at runtime) unchanged. */
type PluginDefinitionInput = Omit<FromcodePlugin, 'manifest'> & { manifest?: PluginManifest };

export class PluginDefinitionUtils {
  /**
   * @deprecated Define plugins directly as `FromcodePlugin` objects — no wrapper needed.
   */
  static define(plugin: PluginDefinitionInput): FromcodePlugin {
    return plugin as FromcodePlugin;
  }
}
