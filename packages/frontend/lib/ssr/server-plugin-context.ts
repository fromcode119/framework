import { FrontendI18nService } from '@fromcode119/react/context/frontend-i18n-service';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';
import { ServerPluginApiSubscription } from '@/lib/ssr/server-plugin-api-subscription';
import { ServerTranslator } from '@/lib/ssr/server-translator';

/**
 * The plugin-context value a theme is pre-rendered against — the server twin of what
 * `ContextProviderValueHooks.useContextValue` publishes in the browser.
 *
 * The slices that come from the API (`menuItems`, `settings`, `plugins`, `activeTheme`,
 * `translations`) are filled with REAL data, because the goal is that the markup painted server-side
 * is the markup the theme renders once it has booted client-side: anything left empty here is a
 * visible change — and a scored layout shift — at that swap.
 *
 * `slots` and `overrides` come from whatever theme and plugin bundles the server managed to load —
 * `fieldComponents` stays empty because nothing renders an admin field on the storefront.
 *
 * `api` is null. Nothing in a theme's layout chrome issues a request during render — data-loading
 * components fetch from an effect, which never runs in `renderToStaticMarkup`. A layout that does
 * dereference it throws, `ThemeServerRenderer` catches, and the page falls back to today's
 * client-only rendering.
 */
export class ServerPluginContext {
  static build(args: {
    themeSlug: string;
    config: Record<string, unknown>;
    serverTranslations: Record<string, unknown>;
    locale: string;
  }): Record<string, unknown> {
    const { themeSlug, config, serverTranslations, locale } = args;
    const noop = () => undefined;
    // Every `registerTranslations` payload, folded in registration order — the same reduction the
    // browser provider performs, so a plugin's copy overlays the theme's the same way on both sides.
    let registered: Record<string, Record<string, unknown>> = {};
    for (const payload of ThemeServerRegistry.translationPayloads()) {
      registered = FrontendI18nService.foldRegistration(registered, payload);
    }
    const translator = new ServerTranslator(serverTranslations, registered, locale);
    const pluginApiSubscription = new ServerPluginApiSubscription();

    return {
      slots: ThemeServerRegistry.slotMap(),
      overrides: ThemeServerRegistry.overrideMap(),
      fieldComponents: {},
      collections: [],
      pluginState: {},
      secondaryPanel: { isOpen: false, activePluginSlug: null, items: [] },

      themeVariables: {},
      themeLayouts: ThemeServerRegistry.layoutsFor(themeSlug),
      themeStyleVariants: ThemeServerRegistry.styleVariantsFor(themeSlug),
      activeTheme: config.activeTheme ?? null,
      menuItems: Array.isArray(config.menu) ? config.menu : [],
      plugins: Array.isArray(config.plugins) ? config.plugins : [],
      settings: (config.settings as Record<string, unknown>) ?? {},

      translations: translator.effective,
      locale,
      t: translator.translate,
      setLocale: noop,

      refreshVersion: 0,
      isReady: true,
      triggerRefresh: noop,

      emit: noop,
      on: () => noop,
      pluginApiSubscription,
      // Backed by what the plugin bundles actually registered during import. Anything a theme resolves
      // through `usePluginsNamespace` — the cms image optimizer above all — depends on these two.
      getPluginApi: ThemeServerRegistry.pluginApi,
      hasPluginApi: ThemeServerRegistry.hasPluginApi,
      registerPluginApi: noop,
      setPluginState: noop,
      registerContentTransformer: noop,
      registerSlotComponent: noop,
      registerFieldComponent: noop,
      registerOverride: noop,
      registerMenuItem: noop,
      replaceMenuItems: noop,
      registerCollection: noop,
      replaceCollections: noop,
      registerPlugins: noop,
      registerTheme: noop,
      registerSettings: noop,

      loadConfig: async () => ({}),
      getFrontendMetadata: async () => config,
      resolveContent: async () => null,
      api: null,
    };
  }
}
