"use client";

import React from 'react';
import ReactDOM from 'react-dom';
import {
  ApiPathUtils,
  ApiScopeClient,
  ApiVersionUtils,
  BrowserStateClient,
  CollectionUtils,
  CoercionUtils,
  FormatUtils,
  HookEventUtils,
  LocalizationUtils,
  NumberUtils,
  PaginationUtils,
  RelationUtils,
  RuntimeConstants,
  StringUtils,
  SystemConstants,
} from '@fromcode119/core/client';
import { BrowserLocalization } from '../browser-localization';
import { CollectionQueryUtils } from '../collection-queries';
import type { CollectionMetadata, MenuItem, PluginContextValue, SecondaryPanelState, SlotComponent } from '../context.interfaces';
import { ContextRuntimeBridge } from '../context-runtime-bridge';
import { FrameworkIconRegistry } from '../framework-icon-registry';
import { FrameworkIcons } from '../framework-icons';
import { PluginContextRegistry } from '../plugin-context';
import { RootFramework } from '../root-framework';
import { SystemShortcodes } from '../system-shortcodes';
import { ContextBridgeHooks } from './context-bridge-hooks';
import { ContextProviderApiHooks } from './context-provider-api-hooks';
import { ContextProviderRegistrationHooks } from './context-provider-registration-hooks';
import { ContextProviderStateService } from './context-provider-state-service';
import type { PluginsProviderInternalProps } from './plugins-provider.types';

function PluginsProviderInternalComponent({ children, apiUrl, clientType, providerClass, runtimeModules }: PluginsProviderInternalProps) {
  const [slots, setSlots] = React.useState<Record<string, SlotComponent[]>>({});
  const [overrides, setOverrides] = React.useState<Record<string, SlotComponent>>({});
  const [themeVariables, setThemeVariables] = React.useState<Record<string, string>>({});
  const [themeLayouts, setThemeLayouts] = React.useState<Record<string, any>>({});
  const [activeTheme, setActiveTheme] = React.useState<any>(null);
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>([]);
  const [secondaryPanel, setSecondaryPanel] = React.useState<SecondaryPanelState>(ContextProviderStateService.createEmptySecondaryPanelState());
  const [collections, setCollections] = React.useState<CollectionMetadata[]>([]);
  const [fieldComponents, setFieldComponents] = React.useState<Record<string, any>>({});
  const [plugins, setPlugins] = React.useState<any[]>([]);
  const [settings, setSettings] = React.useState<Record<string, any>>({});
  const [pluginState, setPluginStateInternal] = React.useState<Record<string, Record<string, any>>>({});
  const [translations, setTranslations] = React.useState<Record<string, any>>({});
  const [locale, setLocale] = React.useState<string>('en');
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
    setSlots,
    setThemeLayouts,
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
    registerSlotComponent,
    registerTheme,
    replaceCollections,
    replaceMenuItems,
    setPluginState,
  } = registrationRuntime;

  const loadTranslations = React.useCallback(async (newLocale: string) => {
    try {
      const encodedLocale = encodeURIComponent(String(newLocale || '').trim() || 'en');
      const data = await api.get(`${SystemConstants.API_PATH.SYSTEM.I18N}?locale=${encodedLocale}`, { silent: true });
      setTranslations(data);
    } catch (error) {
      console.warn('[I18n] Failed to load translations from:', error);
    }
  }, [api]);

  const triggerRefresh = React.useCallback(() => {
    setRefreshVersion((value) => value + 1);
    setSlots({});
    setOverrides({});
    setMenuItems([]);
    setSecondaryPanel(ContextProviderStateService.createEmptySecondaryPanelState());
    setCollections([]);
    loadedConfigPathsRef.current.delete(ContextProviderStateService.getFrontendConfigPath());
    loadTranslations(locale);
  }, [locale, loadTranslations]);

  const t = React.useCallback((key: string, params: Record<string, any> = {}, defaultValue?: string) => {
    let value: any = translations;
    const parts = key.split('.');
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue || key;
      }
    }

    if (typeof value !== 'string') {
      return defaultValue || key;
    }

    return value.replace(/\{\{(.+?)\}\}/g, (_, match) => {
      const paramKey = match.trim();
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
    });
  }, [translations]);

  React.useEffect(() => {
    loadTranslations(locale);
  }, [locale, loadTranslations]);

  React.useEffect(() => {
    stabilityRef.current = {
      activeTheme,
      api,
      apiUrl,
      collections,
      emit,
      fieldComponents,
      getFrontendMetadata,
      getPluginApi,
      hasPluginApi,
      isReady,
      loadConfig,
      locale,
      menuItems,
      on,
      overrides,
      plugins,
      refreshVersion,
      resolveContent,
      runtimeModules,
      secondaryPanel,
      serverRuntimeModules,
      settings,
      setLocale,
      slots,
      t,
      themeLayouts,
      themeVariables,
      translations,
      triggerRefresh,
    };
  }, [activeTheme, api, apiUrl, collections, emit, fieldComponents, getFrontendMetadata, getPluginApi, hasPluginApi, isReady, loadConfig, locale, menuItems, on, overrides, plugins, refreshVersion, resolveContent, runtimeModules, secondaryPanel, serverRuntimeModules, settings, slots, t, themeLayouts, themeVariables, translations, triggerRefresh]);

  const stableT = React.useCallback((...args: any[]) => (stabilityRef.current.t as any)(...args), []);
  const stableLoadConfig = React.useCallback((path?: string) => {
    const resolvedPath = (typeof path === 'string' && path.trim()) ? path.trim() : ContextProviderStateService.getFrontendConfigPath();
    return (stabilityRef.current.loadConfig as any)(resolvedPath);
  }, []);
  const stableGetFrontendMetadata = React.useCallback((...args: any[]) => (stabilityRef.current.getFrontendMetadata as any)(...args), []);
  const stableApiBridge = React.useMemo(() => ({
    getBaseUrl: () => api.getBaseUrl(),
    get: (path: string, options?: any) => api.get(path, options),
    post: (path: string, body?: any, options?: any) => api.post(path, body, options),
    put: (path: string, body?: any, options?: any) => api.put(path, body, options),
    patch: (path: string, body?: any, options?: any) => api.patch(path, body, options),
    delete: (path: string, options?: any) => api.delete(path, options),
  }), [api]);

  React.useEffect(() => {
    plugins.forEach((plugin: any) => {
      const namespace = String(plugin?.namespace || '').trim();
      const slug = String(plugin?.slug || '').trim();
      if (!namespace || !slug || hasPluginApi(namespace, slug)) {
        return;
      }

      const client = new ApiScopeClient(stableApiBridge, ApiPathUtils.pluginPath(slug));
      registerPluginApi(namespace, slug, client);
    });
  }, [hasPluginApi, plugins, registerPluginApi, stableApiBridge]);

  ContextRuntimeBridge.setupGlobalStubs({
    ReactRef: React,
    ReactDOMRef: ReactDOM,
    FrameworkIcons,
    FrameworkIconRegistry,
    getIcon: FrameworkIcons.getIcon.bind(FrameworkIcons),
    IconNames: FrameworkIcons.iconNames(),
    createProxyIcon: FrameworkIcons.createProxyIcon.bind(FrameworkIcons),
  });

  React.useEffect(() => {
    const Slot = require('../slot').Slot;
    const Override = require('../override').Override;

    ContextRuntimeBridge.installRuntimeBridge({
      apiUrl,
      registerContentTransformer,
      registerSlotComponent,
      registerFieldComponent,
      registerOverride,
      registerMenuItem,
      replaceMenuItems,
      registerCollection,
      replaceCollections,
      registerPlugins,
      registerTheme,
      registerSettings,
      registerPluginApi,
      getPluginApi,
      hasPluginApi,
      setPluginState,
      stableLoadConfig,
      stableGetFrontendMetadata,
      emit,
      on,
      stableT,
      stableApiBridge,
      setLocale,
      usePlugins: ContextBridgeHooks.usePluginsBridgeHook,
      useTranslation: ContextBridgeHooks.useTranslationBridgeHook,
      usePluginState: ContextBridgeHooks.usePluginStateBridgeHook,
      useSystemShortcodes: SystemShortcodes.useSystemShortcodes,
      CollectionQueryUtils,
      BrowserLocalization,
      LocalizationUtils,
      RelationUtils,
      CoercionUtils,
      StringUtils,
      NumberUtils,
      FormatUtils,
      ApiVersionUtils,
      CollectionUtils,
      PaginationUtils,
      HookEventUtils,
      isReady,
      PluginsProvider: providerClass,
      RuntimeConstants,
      getIcon: FrameworkIcons.getIcon.bind(FrameworkIcons),
      FrameworkIconRegistry,
      FrameworkIcons,
      IconNames: FrameworkIcons.iconNames(),
      createProxyIcon: FrameworkIcons.createProxyIcon.bind(FrameworkIcons),
      RootFramework,
      Slot,
      Override,
      ReactRef: React,
      ReactDOMRef: ReactDOM,
      runtimeModules,
      stabilityRef,
    });
  }, [apiUrl, emit, getPluginApi, hasPluginApi, isReady, on, providerClass, registerCollection, registerContentTransformer, registerFieldComponent, registerMenuItem, registerOverride, registerPluginApi, registerPlugins, registerSettings, registerSlotComponent, registerTheme, replaceCollections, replaceMenuItems, runtimeModules, setPluginState, stableApiBridge, stableGetFrontendMetadata, stableLoadConfig, stableT]);

  const value = React.useMemo<PluginContextValue>(() => ({
    slots,
    overrides,
    themeVariables,
    themeLayouts,
    activeTheme,
    menuItems,
    secondaryPanel,
    collections,
    fieldComponents,
    plugins,
    settings,
    pluginState,
    translations,
    locale,
    refreshVersion,
    isReady,
    triggerRefresh,
    setLocale,
    t,
    emit,
    on,
    registerPluginApi,
    getPluginApi,
    hasPluginApi,
    setPluginState,
    registerContentTransformer,
    registerSlotComponent,
    registerFieldComponent,
    registerOverride,
    registerMenuItem,
    replaceMenuItems,
    registerCollection,
    replaceCollections,
    registerPlugins,
    registerTheme,
    registerSettings,
    loadConfig,
    getFrontendMetadata,
    resolveContent,
    api,
  }), [activeTheme, api, collections, emit, fieldComponents, getFrontendMetadata, getPluginApi, hasPluginApi, isReady, loadConfig, locale, menuItems, on, overrides, pluginState, plugins, refreshVersion, registerCollection, registerContentTransformer, registerFieldComponent, registerMenuItem, registerOverride, registerPluginApi, registerPlugins, registerSettings, registerSlotComponent, registerTheme, replaceCollections, replaceMenuItems, resolveContent, secondaryPanel, settings, slots, t, themeLayouts, themeVariables, translations, triggerRefresh]);

  return (
    <PluginContextRegistry.Context.Provider value={value}>
      {children}
    </PluginContextRegistry.Context.Provider>
  );
}

export class PluginsProviderInternal extends React.Component<PluginsProviderInternalProps> {
  render(): React.ReactNode {
    return <PluginsProviderInternalComponent {...this.props} />;
  }
}
