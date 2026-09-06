import { bound } from '@fromcode119/reactor';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import type { PluginsProviderSeed } from '@react/context/plugins-provider-seed';
import { ContextProviderStateService } from '@react/context/context-provider-state-service';
import { FrontendI18nService } from '@react/context/frontend-i18n-service';

/**
 * The stability snapshot of the PRE-BOOT bridge — what `ContextBridge.getState()`, `.t()` and
 * `.getFrontendMetadata()` answer from until the live provider's effect installs the real one.
 *
 * The live provider publishes its snapshot from an EFFECT (`useStabilitySnapshot`), so during the first
 * — hydrating — render every bridge-level read still lands here. That render must see exactly what the
 * seeded provider is rendering from, or a `t()` in a theme's render answers the key where the server
 * answered the copy and the page takes the fallback for a mismatch the data never had. Two stages,
 * both answered from the document:
 *   - `fromConfig`: before any bundle evaluates — the inlined `/system/frontend` payload and the locale's
 *     server translations; no registrations yet, so no layouts and no plugin/theme copy;
 *   - `fromSeed`: once the queue is folded — the same `PluginsProviderSeed` the provider is mounted
 *     with, translations resolved through the same three-layer merge the provider's `t` uses.
 * Data slices only: the live snapshot also carries the provider's closures (`api`, `loadConfig`, …),
 * which the pre-boot args supply separately (`PreBootApiBridge`, the queueing stand-ins).
 */
export class PreBootBridgeState {
  readonly apiUrl: string;
  readonly activeTheme: any;
  readonly themeLayouts: Record<string, any>;
  readonly themeStyleVariants: Record<string, any>;
  readonly themeVariables: Record<string, string>;
  readonly slots: Record<string, ISlotComponent[]>;
  readonly overrides: Record<string, ISlotComponent>;
  readonly settings: Record<string, any>;
  readonly menuItems: IMenuItem[];
  readonly secondaryPanel: ISecondaryPanelState;
  readonly collections: ICollectionMetadata[];
  readonly plugins: any[];
  readonly serverRuntimeModules: Record<string, any>;
  readonly locale: string;
  readonly isReady: boolean;
  /** The EFFECTIVE dictionary — server, then plugin, then theme layer — exactly what the provider's `t` reads. */
  readonly translations: Record<string, any>;
  readonly fieldComponents: Record<string, any> = {};
  readonly refreshVersion = 0;

  private constructor(state: {
    apiUrl: string;
    activeTheme: any;
    themeLayouts: Record<string, any>;
    themeStyleVariants: Record<string, any>;
    themeVariables: Record<string, string>;
    slots: Record<string, ISlotComponent[]>;
    overrides: Record<string, ISlotComponent>;
    settings: Record<string, any>;
    menuItems: IMenuItem[];
    secondaryPanel: ISecondaryPanelState;
    collections: ICollectionMetadata[];
    plugins: any[];
    serverRuntimeModules: Record<string, any>;
    locale: string;
    isReady: boolean;
    translations: Record<string, any>;
  }) {
    this.apiUrl = state.apiUrl;
    this.activeTheme = state.activeTheme;
    this.themeLayouts = state.themeLayouts;
    this.themeStyleVariants = state.themeStyleVariants;
    this.themeVariables = state.themeVariables;
    this.slots = state.slots;
    this.overrides = state.overrides;
    this.settings = state.settings;
    this.menuItems = state.menuItems;
    this.secondaryPanel = state.secondaryPanel;
    this.collections = state.collections;
    this.plugins = state.plugins;
    this.serverRuntimeModules = state.serverRuntimeModules;
    this.locale = state.locale;
    this.isReady = state.isReady;
    this.translations = state.translations;
  }

  /** Stage one: the inlined config and the locale's server translations, before any bundle evaluated. */
  static fromConfig(args: { apiUrl: string; frontendConfig: Record<string, any>; locale: string; translations: Record<string, any> }): PreBootBridgeState {
    const { apiUrl, frontendConfig, locale, translations } = args;
    const activeTheme = frontendConfig.activeTheme ?? null;
    return new PreBootBridgeState({
      apiUrl,
      activeTheme,
      themeLayouts: {},
      themeStyleVariants: {},
      themeVariables: activeTheme?.variables || {},
      slots: {},
      overrides: {},
      settings: frontendConfig.settings || {},
      menuItems: Array.isArray(frontendConfig.menu) ? frontendConfig.menu : [],
      secondaryPanel: ContextProviderStateService.resolveNextSecondaryPanelState(
        ContextProviderStateService.createEmptySecondaryPanelState(),
        frontendConfig.secondaryPanel,
      ),
      collections: [],
      plugins: Array.isArray(frontendConfig.plugins) ? frontendConfig.plugins : [],
      serverRuntimeModules: frontendConfig.runtimeModules || {},
      locale: FrontendI18nService.normalizeLocale(locale),
      isReady: true,
      translations: FrontendI18nService.resolveEffective(translations, {}, locale),
    });
  }

  /** Stage two: the seed the provider is about to mount with — the same state, read from the same object. */
  static fromSeed(seed: PluginsProviderSeed, apiUrl: string): PreBootBridgeState {
    return new PreBootBridgeState({
      apiUrl,
      activeTheme: seed.activeTheme,
      themeLayouts: seed.themeLayouts,
      themeStyleVariants: seed.themeStyleVariants,
      themeVariables: seed.themeVariables,
      slots: seed.slots,
      overrides: seed.overrides,
      settings: seed.settings,
      menuItems: seed.menuItems,
      secondaryPanel: seed.secondaryPanel,
      collections: seed.collections,
      plugins: seed.plugins,
      serverRuntimeModules: seed.serverRuntimeModules,
      locale: seed.locale,
      isReady: seed.isReady,
      translations: FrontendI18nService.resolveEffective(seed.translations, seed.registeredTranslations, seed.locale, seed.themeTranslations),
    });
  }

  /** The provider's `t`, over this snapshot's effective dictionary — the one lookup implementation. */
  @bound t(key: string, params: Record<string, any> = {}, defaultValue?: string): string {
    return FrontendI18nService.translate(this.translations, key, params, defaultValue);
  }

  /** What `getFrontendMetadata()` returns — the same slices the live provider's answer carries. */
  get frontendMetadata(): Record<string, any> {
    return {
      activeTheme: this.activeTheme,
      themeLayouts: this.themeLayouts,
      themeStyleVariants: this.themeStyleVariants,
      themeVariables: this.themeVariables,
      settings: this.settings,
      menuItems: this.menuItems,
      secondaryPanel: this.secondaryPanel,
      collections: this.collections,
      plugins: this.plugins,
    };
  }
}
