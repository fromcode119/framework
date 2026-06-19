"use client";

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserStateClient } from '@fromcode119/core/client';
import type { CollectionMetadata, MenuItem, SecondaryPanelState, SlotComponent } from '../context.interfaces';
import { PluginContextRegistry } from '../plugin-context';
import { ContextProviderApiHooks } from './context-provider-api-hooks';
import { ContextProviderI18nHooks } from './context-provider-i18n-hooks';
import { ContextProviderRegistrationHooks } from './context-provider-registration-hooks';
import { ContextProviderRuntimeBridgeHooks } from './context-provider-runtime-bridge-hooks';
import { ContextProviderStabilityHooks } from './context-provider-stability-hooks';
import { ContextProviderStateService } from './context-provider-state-service';
import { ContextProviderValueHooks } from './context-provider-value-hooks';
import { FrontendI18nService } from './frontend-i18n-service';
import { CollectionsContext } from './collections-context';
import { MenuContext } from './menu-context';
import { OverridesContext } from './overrides-context';
import { PluginStateContext } from './plugin-state-context';
import { SettingsContext } from './settings-context';
import { SlotsContext } from './slots-context';
import { TranslationContext } from './translation-context';
import type { PluginsProviderInternalProps } from './plugins-provider.types';

function PluginsProviderInternalComponent({ children, apiUrl, clientType, providerClass, runtimeModules }: PluginsProviderInternalProps) {
  const [slots, setSlots] = React.useState<Record<string, SlotComponent[]>>({});
  const [overrides, setOverrides] = React.useState<Record<string, SlotComponent>>({});
  const [themeVariables, setThemeVariables] = React.useState<Record<string, string>>({});
  const [themeLayouts, setThemeLayouts] = React.useState<Record<string, any>>({});
  const [themeStyleVariants, setThemeStyleVariants] = React.useState<Record<string, any>>({});
  const [activeTheme, setActiveTheme] = React.useState<any>(null);
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>([]);
  const [secondaryPanel, setSecondaryPanel] = React.useState<SecondaryPanelState>(ContextProviderStateService.createEmptySecondaryPanelState());
  const [collections, setCollections] = React.useState<CollectionMetadata[]>([]);
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
  const [pluginAPIs] = React.useState<Record<string, any>>({});
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
    pluginAPIs,
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

  ContextProviderRuntimeBridgeHooks.usePluginApiRegistration({ plugins, hasPluginApi, registerPluginApi, stableApiBridge });

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
    getPluginApi, hasPluginApi, setPluginState, registerContentTransformer, registerSlotComponent,
    registerFieldComponent, registerOverride, registerMenuItem, replaceMenuItems, registerCollection,
    replaceCollections, registerPlugins, registerTheme, registerSettings, loadConfig, getFrontendMetadata,
    resolveContent, api,
  });

  const translationValue = React.useMemo(() => ({ t, locale, setLocale }), [t, locale]);
  const pluginStateValue = React.useMemo(() => ({ pluginState, setPluginState }), [pluginState, setPluginState]);

  return (
    <SlotsContext.Context.Provider value={slots}>
      <OverridesContext.Context.Provider value={overrides}>
        <TranslationContext.Context.Provider value={translationValue}>
          <PluginStateContext.Context.Provider value={pluginStateValue}>
            <CollectionsContext.Context.Provider value={collections}>
              <MenuContext.Context.Provider value={menuItems}>
                <SettingsContext.Context.Provider value={settings}>
                  <PluginContextRegistry.Context.Provider value={value}>
                    {children}
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

export class PluginsProviderInternal extends React.Component<PluginsProviderInternalProps> {
  render(): React.ReactNode {
    return <PluginsProviderInternalComponent {...this.props} />;
  }
}
