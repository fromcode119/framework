import { I18nManager } from '@core/i18n/i18n-manager';
import { I18nContextProxy } from '@core/plugin/context/i18n';
import type { PluginGuestDeclarations } from '@core/plugin/host/declarations/plugin-guest-declarations';
import { PluginPathContextProxy } from '@core/plugin/context/paths';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { ITranslationMap } from '@core/interfaces/translation-map.interface';

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

  /**
   * One promise per translation registration forwarded to the host, so `flush()` can wait for all of
   * them. Registration runs inside synchronous on-init plugin code, so the forward itself is
   * fire-and-forget over the remote channel — tracked here rather than awaited on the spot.
   */
  private readonly pendingI18nForwards: Promise<unknown>[] = [];

  constructor(boot: IPluginGuestBoot, remote: PluginGuestRemote, declarations: PluginGuestDeclarations) {
    const plugin = { manifest: boot.manifest, path: boot.pluginDir } as unknown as ILoadedPlugin;
    const localI18n = new I18nManager(boot.defaultLocale);
    // `getI18n` (system-runtime-controller) reads translations from ONE place: the host's own
    // `I18nManager`, filled only by `context.i18n.registerTranslations` running in-process. An
    // isolated plugin's on-init runs in THIS process instead, against `localI18n`, so the host's map
    // never saw a single key — the storefront asked for a Bulgarian button and got `{}`. This bridge
    // keeps `registerTranslations` answering the local manager (so `t()`/`translateOrFallback` stay
    // synchronous) AND forwards the exact same (locale, translations) pair to the host's
    // `context.i18n.registerTranslations(locale, translations)` two-argument form — the one that
    // namespaces under this plugin's own slug, exactly as a non-isolated boot would have produced.
    const i18nBridge = {
      registerTranslations: (locale: string, namespace: string, translations: ITranslationMap) => {
        localI18n.registerTranslations(locale, namespace, translations);
        this.pendingI18nForwards.push(declarations.declare('i18n', 'registerTranslations', [locale, translations]));
      },
      translate: (key: string, params?: Record<string, any>, locale?: string) => localI18n.translate(key, params, locale),
      translateOrFallback: (key: string, fallback: string, params?: Record<string, any>, locale?: string) =>
        localI18n.translateOrFallback(key, fallback, params, locale),
      getDefaultLocale: () => localI18n.getDefaultLocale(),
    };
    // Only what the two proxies read: translations, the active theme (for theme-scoped keys and
    // theme template reads, answered by the host), and a log sink. Capability checks stay on the
    // host, where every real call is gated; these locals touch nothing but the plugin's own files.
    const manager: any = {
      i18n: i18nBridge,
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
    // The site's clock lives in framework settings only the host reads; asked of the host per call,
    // so it is the clock of the site the calling request (or scheduled run) is bound to.
    this.i18n = {
      ...I18nContextProxy.createI18nProxy(plugin, manager, this.paths, security),
      siteClock: () => remote.ref('context', [{ name: 'i18n' }]).siteClock(),
    };
  }

  get t(): (key: string, params?: Record<string, unknown>, locale?: string) => string {
    return (key, params, locale) => this.i18n.t(key, params, locale);
  }

  /**
   * Waits for every translation forward started so far. Called once after a lifecycle hook returns
   * (`PluginGuest.run`), so the RPC response the host is awaiting — and therefore the plugin being
   * reported active — does not land before the host's i18n map actually has the plugin's keys in it.
   */
  async flush(): Promise<void> {
    await Promise.allSettled(this.pendingI18nForwards);
  }
}
