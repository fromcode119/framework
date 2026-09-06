import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import { ContextProviderStateService } from '@react/context/context-provider-state-service';
import { FrontendI18nService } from '@react/context/frontend-i18n-service';
import { PluginApiRegistryStore } from '@react/context/plugin-api-registry-store';
import { PreBootRegistrationSeed } from '@react/context/pre-boot-registration-seed';

/**
 * Everything `PluginsProviderInternal` initialises its state from.
 *
 * `empty()` is EXACTLY today's initial state — the provider reads every slice from a seed, and a provider
 * mounted without one (the admin, the Next storefront) gets `empty()`, so nothing changes for them.
 *
 * `fromFrontendConfig()` is the islands boot: the public `/system/frontend` payload the document inlined,
 * the locale's server translations, and the registrations the theme and eager plugin bundles queued
 * before the provider existed. A provider seeded this way starts READY — `loadConfig` for the frontend
 * path is recorded as already loaded, so nothing fetches what the document already carried — and
 * shares its plugin-API store and event map with the pre-boot bridge, so a client a plugin registered
 * at evaluation is in the registry for the very first render.
 */
export class PluginsProviderSeed {
  readonly slots: Record<string, ISlotComponent[]>;
  readonly overrides: Record<string, ISlotComponent>;
  readonly themeVariables: Record<string, string>;
  readonly themeLayouts: Record<string, any>;
  readonly themeStyleVariants: Record<string, any>;
  readonly registeredTranslations: Record<string, Record<string, any>>;
  readonly themeTranslations: Record<string, Record<string, any>>;
  readonly activeTheme: any;
  readonly menuItems: IMenuItem[];
  readonly secondaryPanel: ISecondaryPanelState;
  readonly collections: ICollectionMetadata[];
  readonly plugins: any[];
  readonly settings: Record<string, any>;
  readonly translations: Record<string, any>;
  readonly locale: string;
  readonly isReady: boolean;
  readonly serverRuntimeModules: Record<string, any>;
  readonly pluginApiStore: PluginApiRegistryStore;
  readonly events: Map<string, Set<(data: any) => void>>;
  /** Config paths to record as loaded, so a later `loadConfig()` for them is a no-op. */
  readonly loadedConfigPaths: ReadonlySet<string>;
  /** The locale whose server translations are seeded — that locale's first fetch is skipped. */
  readonly seededTranslationsLocale: string;

  private constructor(state: {
    registrations: PreBootRegistrationSeed;
    activeTheme: any;
    menuItems: IMenuItem[];
    secondaryPanel: ISecondaryPanelState;
    collections: ICollectionMetadata[];
    plugins: any[];
    settings: Record<string, any>;
    translations: Record<string, any>;
    locale: string;
    isReady: boolean;
    serverRuntimeModules: Record<string, any>;
    pluginApiStore: PluginApiRegistryStore;
    events: Map<string, Set<(data: any) => void>>;
    loadedConfigPaths: ReadonlySet<string>;
    seededTranslationsLocale: string;
  }) {
    const r = state.registrations;
    this.slots = r.slots;
    this.overrides = r.overrides;
    this.themeVariables = r.themeVariables;
    this.themeLayouts = r.themeLayouts;
    this.themeStyleVariants = r.themeStyleVariants;
    this.registeredTranslations = r.registeredTranslations;
    this.themeTranslations = r.themeTranslations;
    this.activeTheme = state.activeTheme;
    this.menuItems = state.menuItems;
    this.secondaryPanel = state.secondaryPanel;
    this.collections = state.collections;
    this.plugins = state.plugins;
    this.settings = state.settings;
    this.translations = state.translations;
    this.locale = state.locale;
    this.isReady = state.isReady;
    this.serverRuntimeModules = state.serverRuntimeModules;
    this.pluginApiStore = state.pluginApiStore;
    this.events = state.events;
    this.loadedConfigPaths = state.loadedConfigPaths;
    this.seededTranslationsLocale = state.seededTranslationsLocale;
  }

  /** The provider's own defaults — what a provider without a seed has always started from. */
  static empty(): PluginsProviderSeed {
    return new PluginsProviderSeed({
      registrations: PreBootRegistrationSeed.empty(),
      activeTheme: null,
      menuItems: [],
      secondaryPanel: ContextProviderStateService.createEmptySecondaryPanelState(),
      collections: [],
      plugins: [],
      settings: {},
      translations: {},
      locale: FrontendI18nService.detectInitialLocale(),
      isReady: false,
      serverRuntimeModules: {},
      pluginApiStore: new PluginApiRegistryStore(),
      events: new Map(),
      loadedConfigPaths: new Set(),
      seededTranslationsLocale: '',
    });
  }

  /**
   * Seed from the inlined `/system/frontend` payload — the same reduction `loadConfig` performs on that
   * payload (plugins → their admin collections stamped with `pluginSlug`; the theme's `variables` under
   * the registered ones, exactly the order the live path reaches after the theme bundle registers).
   */
  static fromFrontendConfig(args: {
    config: Record<string, any>;
    registrations: PreBootRegistrationSeed;
    translations: Record<string, any>;
    locale: string;
    pluginApiStore: PluginApiRegistryStore;
    events: Map<string, Set<(data: any) => void>>;
  }): PluginsProviderSeed {
    const { config, registrations, translations, locale, pluginApiStore, events } = args;
    const plugins: any[] = Array.isArray(config.plugins) ? config.plugins : [];
    const activeTheme = config.activeTheme ?? null;
    const seeded = registrations.withThemeVariables({ ...(activeTheme?.variables || {}), ...registrations.themeVariables });
    const normalizedLocale = FrontendI18nService.normalizeLocale(locale);

    return new PluginsProviderSeed({
      registrations: seeded,
      activeTheme,
      menuItems: Array.isArray(config.menu) ? config.menu : [],
      secondaryPanel: ContextProviderStateService.resolveNextSecondaryPanelState(
        ContextProviderStateService.createEmptySecondaryPanelState(),
        config.secondaryPanel,
      ),
      collections: PluginsProviderSeed.collectionsOf(plugins),
      plugins,
      settings: (config.settings as Record<string, any>) || {},
      translations,
      locale: normalizedLocale,
      isReady: true,
      serverRuntimeModules: (config.runtimeModules as Record<string, any>) || {},
      pluginApiStore,
      events,
      loadedConfigPaths: new Set([ContextProviderStateService.getFrontendConfigPath()]),
      seededTranslationsLocale: normalizedLocale,
    });
  }

  /** `loadConfig`'s own derivation of the collections slice, restated once. */
  private static collectionsOf(plugins: any[]): ICollectionMetadata[] {
    const all: ICollectionMetadata[] = [];
    plugins.forEach((plugin: any) => {
      if (plugin?.admin?.collections) {
        all.push(...plugin.admin.collections.map((collection: any) => ({ ...collection, pluginSlug: plugin.slug })));
      }
    });
    return all;
  }
}
