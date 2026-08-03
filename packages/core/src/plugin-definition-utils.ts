import type { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';
import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';

/** The define() input: a plugin definition whose `manifest` is OPTIONAL — most plugins ship their manifest
 *  as a separate `manifest.json` and pass only lifecycle hooks + publicAPI here; only inline-manifest
 *  plugins (numerology, build-server) provide `manifest`. Keeps `FromcodePlugin`/`LoadedPlugin` (which
 *  always have a resolved manifest at runtime) unchanged. */
export class PluginDefinitionUtils {
  /**
   * @deprecated Define plugins directly as `FromcodePlugin` objects — no wrapper needed.
   */
  static define(plugin: Omit<IFromcodePlugin, 'manifest'> & { manifest?: IPluginManifest }): IFromcodePlugin {
    return plugin as IFromcodePlugin;
  }
}
