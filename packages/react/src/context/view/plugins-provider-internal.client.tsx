import React from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { Bridge, prop } from '@fromcode119/reactor';
import { ClientType } from '@fromcode119/core/client';
import { BrowserStateClient } from '@fromcode119/core/client';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import { PluginContextRegistry } from '@react/plugin-context';
import { ContextProviderApiHooks } from '@react/context/context-provider-api-hooks';
import { ContextProviderI18nHooks } from '@react/context/context-provider-i18n-hooks';
import { ContextProviderRegistrationHooks } from '@react/context/context-provider-registration-hooks';
import { ContextProviderRuntimeBridgeHooks } from '@react/context/context-provider-runtime-bridge-hooks';
import { ContextProviderStabilityHooks } from '@react/context/context-provider-stability-hooks';
import { ContextProviderStateService } from '@react/context/context-provider-state-service';
import { ContextProviderValueHooks } from '@react/context/context-provider-value-hooks';
import { FrontendI18nService } from '@react/context/frontend-i18n-service';
import { CollectionsContext } from '@react/context/collections-context';
import { MenuContext } from '@react/context/menu-context';
import { OverridesContext } from '@react/context/overrides-context';
import { PluginApiRegistryStore } from '@react/context/plugin-api-registry-store';
import { PluginStateContext } from '@react/context/plugin-state-context';
import { SettingsContext } from '@react/context/settings-context';
import { SlotsContext } from '@react/context/slots-context';
import { TranslationContext } from '@react/context/translation-context';
import type { IPluginsProviderRuntimeValues } from '@react/context/interfaces/plugins-provider-runtime-values.interface';

/**
 * The plugin runtime context: two dozen state slices, seven hook aggregators, and the provider tree
 * that publishes them.
 *
 * A `Bridge` — reactor's ONE sanctioned hook site. Every hook lives in `read()` (React sees a single
 * component whose hook order never varies) and `present()` is pure rendering. This replaces the
 * previous shape, an `export class` that existed only to wrap a `function` component holding the hooks.
 */
export class PluginsProviderInternal extends Bridge<IPluginsProviderRuntimeValues> {
  @prop declare children: ReactNode;
  @prop declare apiUrl: string;
  @prop declare clientType: ClientType;
  @prop declare runtimeModules?: Record<string, unknown>;
  /** The public `PluginsProvider` class, handed to the runtime bridge installer. */
  @prop declare providerClass: unknown;

  protected read(): IPluginsProviderRuntimeValues {
    const { children: _children, apiUrl, clientType, providerClass, runtimeModules } = this;
    const [slots, setSlots] = React.useState<Record<string, ISlotComponent[]>>({});
    const [overrides, setOverrides] = React.useState<Record<string, ISlotComponent>>({});
    const [themeVariables, setThemeVariables] = React.useState<Record<string, string>>({});
    const [themeLayouts, setThemeLayouts] = React.useState<Record<string, any>>({});
    const [themeStyleVariants, setThemeStyleVariants] = React.useState<Record<string, any>>({});
    const [activeTheme, setActiveTheme] = React.useState<any>(null);
    const [menuItems, setMenuItems] = React.useState<IMenuItem[]>([]);
    const [secondaryPanel, setSecondaryPanel] = React.useState<ISecondaryPanelState>(ContextProviderStateService.createEmptySecondaryPanelState());
    const [collections, setCollections] = React.useState<ICollectionMetadata[]>([]);
    const [fieldComponents, setFieldComponents] = React.useState<Record<string, any>>({});
    const [plugins, setPlugins] = React.useState<any[]>([]);
    const [settings, setSettings] = React.useState<Record<string, any>>({});
    const [pluginState, setPluginStateInternal] = React.useState<Record<string, Record<string, any>>>({});
    const [translations, setTranslations] = React.useState<Record<string, any>>({});
    // Plugin/theme UI translations registered via registerTranslations, stored per locale ('*' bucket
    // for legacy flat dicts). Kept separate from the server `translations` so a locale change recomputes
    // the active language without plugins having to re-register.
    const [registeredTranslations, setRegisteredTranslations] = React.useState<Record<string, Record<string, any>>>({});
    const [locale, setLocale] = React.useState<string>(() => FrontendI18nService.detectInitialLocale());
    const [refreshVersion, setRefreshVersion] = React.useState(0);
    const [isReady, setIsReady] = React.useState(false);
    const [pluginApiStore] = React.useState(() => new PluginApiRegistryStore());
    const [events] = React.useState(() => new Map<string, Set<(data: any) => void>>());
    const [serverRuntimeModules, setServerRuntimeModules] = React.useState<Record<string, any>>({});
    const inFlightConfigLoadsRef = React.useRef<Map<string, Promise<any>>>(new Map());
    const loadedConfigPathsRef = React.useRef<Set<string>>(new Set());
    const stabilityRef = React.useRef<any>({});
    const browserState = React.useMemo(() => new BrowserStateClient(), []);

    const apiRuntime = ContextProviderApiHooks.useApiRuntime({
      apiUrl,
      browserState,
      clientType,
      inFlightConfigLoadsRef,
      loadedConfigPathsRef,
      locale,
      setActiveTheme,
      setCollections,
      setIsReady,
      setMenuItems,
      setPlugins,
      setSecondaryPanel,
      setServerRuntimeModules,
      setSettings,
      setThemeVariables,
      settings,
      stabilityRef,
    });
    const registrationRuntime = ContextProviderRegistrationHooks.useRegistrationRuntime({
      events,
      pluginApiStore,
      setCollections,
      setFieldComponents,
      setMenuItems,
      setOverrides,
      setPluginStateInternal,
      setPlugins,
      setRefreshVersion,
      setSettings,
      setRegisteredTranslations,
      setSlots,
      setThemeLayouts,
      setThemeStyleVariants,
      setThemeVariables,
    });

    const { api, getFrontendMetadata, loadConfig, resolveContent } = apiRuntime;
    const {
      emit,
      getPluginApi,
      hasPluginApi,
      on,
      registerCollection,
      registerContentTransformer,
      registerFieldComponent,
      registerMenuItem,
      registerOverride,
      registerPluginApi,
      registerPluginApiFromRender,
      registerPlugins,
      registerSettings,
      registerTranslations,
      registerSlotComponent,
      registerTheme,
      replaceCollections,
      replaceMenuItems,
      setPluginState,
    } = registrationRuntime;

    const { triggerRefresh, effectiveTranslations, t } = ContextProviderI18nHooks.useI18nRuntime({
      api, locale, translations, registeredTranslations, loadedConfigPathsRef, setTranslations,
      setRefreshVersion, setSlots, setOverrides, setMenuItems, setSecondaryPanel, setCollections,
    });

    ContextProviderStabilityHooks.useStabilitySnapshot({
      stabilityRef,
      snapshot: {
        activeTheme, api, apiUrl, collections, emit, fieldComponents, getFrontendMetadata, getPluginApi,
        hasPluginApi, isReady, loadConfig, locale, menuItems, on, overrides, plugins, refreshVersion,
        resolveContent, runtimeModules, secondaryPanel, serverRuntimeModules, settings, setLocale, slots, t,
        themeLayouts, themeStyleVariants, themeVariables, translations: effectiveTranslations, triggerRefresh,
      },
    });

    const { stableT, stableLoadConfig, stableGetFrontendMetadata, stableApiBridge } = ContextProviderStabilityHooks.useStableHandles({ stabilityRef });

    ContextProviderRuntimeBridgeHooks.usePluginApiRegistration({ clientType, plugins, hasPluginApi, registerPluginApi: registerPluginApiFromRender, stableApiBridge });

    ContextProviderRuntimeBridgeHooks.setupGlobalStubs(ReactDOM);

    ContextProviderRuntimeBridgeHooks.useRuntimeBridgeInstall({
      apiUrl,
      isReady,
      providerClass,
      runtimeModules,
      stabilityRef,
      registration: {
        registerContentTransformer, registerSlotComponent, registerFieldComponent, registerOverride,
        registerMenuItem, replaceMenuItems, registerCollection, replaceCollections, registerPlugins,
        registerTheme, registerSettings, registerTranslations, registerPluginApi, getPluginApi,
        hasPluginApi, setPluginState, emit, on,
      },
      stable: { stableLoadConfig, stableGetFrontendMetadata, stableT, stableApiBridge, setLocale },
    });

    const value = ContextProviderValueHooks.useContextValue({
      slots, overrides, themeVariables, themeLayouts, themeStyleVariants, activeTheme, menuItems,
      secondaryPanel, collections, fieldComponents, plugins, settings, pluginState, effectiveTranslations,
      locale, refreshVersion, isReady, triggerRefresh, setLocale, t, emit, on, registerPluginApi,
      getPluginApi, hasPluginApi, pluginApiSubscription: pluginApiStore, setPluginState, registerContentTransformer, registerSlotComponent,
      registerFieldComponent, registerOverride, registerMenuItem, replaceMenuItems, registerCollection,
      replaceCollections, registerPlugins, registerTheme, registerSettings, loadConfig, getFrontendMetadata,
      resolveContent, api,
    });

    const translationValue = React.useMemo(() => ({ t, locale, setLocale }), [t, locale]);
    const pluginStateValue = React.useMemo(() => ({ pluginState, setPluginState }), [pluginState, setPluginState]);

    return { slots, overrides, collections, menuItems, settings, translationValue, pluginStateValue, value };
  }

  protected present(values: IPluginsProviderRuntimeValues): ReactNode {
    const { slots, overrides, collections, menuItems, settings, translationValue, pluginStateValue, value } = values;
    return (
      <SlotsContext.Context.Provider value={slots}>
        <OverridesContext.Context.Provider value={overrides}>
          <TranslationContext.Context.Provider value={translationValue as never}>
            <PluginStateContext.Context.Provider value={pluginStateValue as never}>
              <CollectionsContext.Context.Provider value={collections}>
                <MenuContext.Context.Provider value={menuItems}>
                  <SettingsContext.Context.Provider value={settings}>
                    <PluginContextRegistry.Context.Provider value={value as never}>
                      {this.children}
                    </PluginContextRegistry.Context.Provider>
                  </SettingsContext.Context.Provider>
                </MenuContext.Context.Provider>
              </CollectionsContext.Context.Provider>
            </PluginStateContext.Context.Provider>
          </TranslationContext.Context.Provider>
        </OverridesContext.Context.Provider>
      </SlotsContext.Context.Provider>
    );
  }
}
