import React from 'react';
import {
  ApiPathUtils,
  ApiScopeClient,
  ApiVersionUtils,
  CoercionUtils,
  CollectionUtils,
  FormatUtils,
  HookEventUtils,
  LocalizationUtils,
  NumberUtils,
  PaginationUtils,
  RelationUtils,
  RuntimeConstants,
  StringUtils,
} from '@fromcode119/core/client';
import { BrowserLocalization } from '../browser-localization';
import { CollectionQueryUtils } from '../collection-queries';
import { ContextRuntimeBridge } from '../context-runtime-bridge';
import { FrameworkIconRegistry } from '../framework-icon-registry';
import { FrameworkIcons } from '../framework-icons';
import { RootFramework } from '../root-framework';
import { SystemShortcodes } from '../system-shortcodes';
import { ContextBridgeHooks } from './context-bridge-hooks';

export class ContextProviderRuntimeBridgeHooks {
  static setupGlobalStubs(ReactDOMRef: any): void {
    ContextRuntimeBridge.setupGlobalStubs({
      ReactRef: React,
      ReactDOMRef,
      FrameworkIcons,
      FrameworkIconRegistry,
      getIcon: FrameworkIcons.getIcon.bind(FrameworkIcons),
      IconNames: FrameworkIcons.iconNames(),
      createProxyIcon: FrameworkIcons.createProxyIcon.bind(FrameworkIcons),
    });
  }

  static usePluginApiRegistration(args: {
    plugins: any[];
    hasPluginApi: (namespace: string, slug: string) => boolean;
    registerPluginApi: (namespace: string, slug: string, client: any) => void;
    stableApiBridge: any;
  }) {
    const { plugins, hasPluginApi, registerPluginApi, stableApiBridge } = args;

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
  }

  static useRuntimeBridgeInstall(args: {
    apiUrl: string;
    isReady: boolean;
    providerClass: any;
    runtimeModules: any;
    stabilityRef: React.MutableRefObject<any>;
    registration: {
      registerContentTransformer: any;
      registerSlotComponent: any;
      registerFieldComponent: any;
      registerOverride: any;
      registerMenuItem: any;
      replaceMenuItems: any;
      registerCollection: any;
      replaceCollections: any;
      registerPlugins: any;
      registerTheme: any;
      registerSettings: any;
      registerTranslations: any;
      registerPluginApi: any;
      getPluginApi: any;
      hasPluginApi: any;
      setPluginState: any;
      emit: any;
      on: any;
    };
    stable: {
      stableLoadConfig: any;
      stableGetFrontendMetadata: any;
      stableT: any;
      stableApiBridge: any;
      setLocale: any;
    };
  }) {
    const { apiUrl, isReady, providerClass, runtimeModules, stabilityRef, registration, stable } = args;
    const {
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
      registerTranslations,
      registerPluginApi,
      getPluginApi,
      hasPluginApi,
      setPluginState,
      emit,
      on,
    } = registration;
    const { stableLoadConfig, stableGetFrontendMetadata, stableT, stableApiBridge, setLocale } = stable;

    React.useEffect(() => {
      const Slot = require('../slot').Slot;
      const Override = require('../override').Override;
      const AccountShell = require('../account-shell').AccountShell;
      const RecordsHub = require('../records-hub').RecordsHub;
      const ReactDOM = require('react-dom');

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
        registerTranslations,
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
        AccountShell,
        RecordsHub,
        ReactRef: React,
        ReactDOMRef: ReactDOM,
        runtimeModules,
        stabilityRef,
      });
    }, [apiUrl, emit, getPluginApi, hasPluginApi, isReady, on, providerClass, registerCollection, registerContentTransformer, registerFieldComponent, registerMenuItem, registerOverride, registerPluginApi, registerPlugins, registerSettings, registerSlotComponent, registerTheme, registerTranslations, replaceCollections, replaceMenuItems, runtimeModules, setPluginState, stableApiBridge, stableGetFrontendMetadata, stableLoadConfig, stableT, setLocale, stabilityRef]);
  }
}
