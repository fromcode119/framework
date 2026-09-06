import { I18nManager } from '@core/i18n/i18n-manager';
import { I18nContextProxy } from '@core/plugin/context/i18n';
import { PluginPathContextProxy } from '@core/plugin/context/paths';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * The parts of the context that must answer SYNCHRONOUSLY and therefore live in the guest.
 *
 * `context.t(key)` and `context.i18n.translateOrFallback(...)` return strings that plugin code uses
 * in the same expression (a settings label, an email subject); a message to the host cannot do that.
 * A plugin's translations are its own files, so the guest loads them itself into a local
 * `I18nManager` seeded with the platform's default locale, through the very same proxy the host
 * uses. `context.paths` is likewise local: it reads the plugin's own directory.
 */
export class PluginGuestLocals {
  readonly i18n: ReturnType<typeof I18nContextProxy.createI18nProxy>;
  readonly paths: PluginPathContextProxy;

  constructor(boot: IPluginGuestBoot, remote: PluginGuestRemote) {
    const plugin = { manifest: boot.manifest, path: boot.pluginDir } as unknown as ILoadedPlugin;
    // Only what the two proxies read: translations, the active theme (for theme-scoped keys and
    // theme template reads, answered by the host), and a log sink. Capability checks stay on the
    // host, where every real call is gated; these locals touch nothing but the plugin's own files.
    const manager: any = {
      i18n: new I18nManager(boot.defaultLocale),
      themeManager: null,
      db: remote.ref('context', [{ name: 'db' }]),
      writeLog: async () => undefined,
    };
    const security: any = { hasCapability: () => true, handleViolation: () => undefined, handleRateLimit: () => undefined };
    // The active theme comes from the HOST's own answer, not from a table read through the plugin's
    // guarded `context.db` — that read is framework work, and the guard rightly refuses it here.
    this.paths = new PluginPathContextProxy(plugin, manager, async () => {
      const slug = await remote.ref('context', [{ name: 'theme' }]).getActiveSlug();
      return typeof slug === 'string' ? slug : null;
    });
    this.i18n = I18nContextProxy.createI18nProxy(plugin, manager, this.paths, security);
  }

  get t(): (key: string, params?: Record<string, unknown>, locale?: string) => string {
    return (key, params, locale) => this.i18n.t(key, params, locale);
  }
}
