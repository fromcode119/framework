import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { CoreServices } from '@core/services/core-services';

/**
 * Plugin-facing facade over the "needs you" registry.
 *
 * A plugin says what IT considers unfinished — "3 orders paid and not fulfilled", "2 submissions
 * nobody answered" — and the dashboard shows it beside the framework's own platform checks. The
 * namespace and slug come from the manifest, so a plugin supplies only the provider.
 *
 * `resolve` runs on dashboard load. Keep it to one counting query; anything expensive belongs on the
 * plugin's own screen, and a provider that takes longer than two seconds is dropped for that load.
 */
export class AttentionContextProxy {
  static createAttentionProxy(plugin: ILoadedPlugin) {
    const namespace = String(plugin?.manifest?.namespace || '').trim();
    const pluginSlug = String(plugin?.manifest?.slug || '').trim();

    return {
      registerProvider(input: { key: string; label: string; resolve: () => Promise<unknown[]> | unknown[] }) {
        CoreServices.getInstance().attention.register({
          namespace,
          pluginSlug,
          key: String(input?.key || '').trim(),
          label: String(input?.label || '').trim(),
          resolve: input?.resolve,
        });
      },

      unregister(key: string) {
        CoreServices.getInstance().attention.unregister(`${namespace}:${pluginSlug}:${String(key || '').trim()}`);
      },
    };
  }
}
