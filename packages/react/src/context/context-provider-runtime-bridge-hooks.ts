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
  PluginFrontendRuntimeUtils,
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
      getIcon: (name: string) => FrameworkIcons.getIcon(name),
      IconNames: FrameworkIcons.iconNames(),
      createProxyIcon: (name: string) => FrameworkIcons.createProxyIcon(name),
    });
  }

  static usePluginApiRegistration(args: {
    clientType: string;
    plugins: any[];
    hasPluginApi: (namespace: string, slug: string) => boolean;
    registerPluginApi: (namespace: string, slug: string, client: any) => void;
    stableApiBridge: any;
  }) {
    const { clientType, plugins, hasPluginApi, registerPluginApi, stableApiBridge } = args;
    const loadsPluginRuntimes = clientType === RuntimeConstants.CLIENT_TYPES.FRONTEND_UI;

    // Registered DURING render (not in an effect) so the very first render that sees a plugin list
    // already has its API clients in the registry — children below this provider resolve plugin
    // namespaces on their first render instead of after a post-hydration effect flushes. The effect
    // form caused a render waterfall (hydrate -> effect -> register -> consumers re-render -> only
    // then discover their lazy chunks) and a post-hydration race where a theme component could read
    // an unregistered namespace.
    //
    // Safe in the render phase because it is a pure-ish, idempotent registry write:
    //   - `registerPluginApi` writes into the provider's `PluginApiRegistryStore`; it never calls
    //     setState, so there is no render-phase update of another component. The store bumps its
    //     version synchronously (children rendering in this same pass read the fresh snapshot) and
    //     notifies `useSyncExternalStore` subscribers post-commit via one coalesced microtask.
    //   - the `hasPluginApi` guard makes repeats (StrictMode double render, discarded concurrent
    //     renders) no-ops.
    //   - `ApiScopeClient`'s constructor only stores its arguments — it touches no browser globals.
    // `useMemo` keeps this off unrelated re-renders while still covering late-arriving plugins:
    // new plugins can only appear via a `setPlugins` call, which yields a fresh `plugins` identity.
    //
    // What it registers is a GENERIC `ApiScopeClient` — the bare REST surface, and nothing else. That
    // is the right client only for a plugin that never registers one itself. A plugin whose frontend
    // runtime module this app loads DOES register its own (method-rich) client when that module
    // evaluates, a few hundred ms later; pre-filling its key with the generic stand-in publishes an
    // object that is truthy but missing the plugin's real API for the whole gap. Consumers cannot
    // defend against that: the correct presence check (`if (!api) return fallback;`) passes, and the
    // next line throws (`ecommerce.storefront(...)` -> "is not a function"), taking out the render
    // tree. Leaving the key EMPTY until the real client lands is the honest state — "absent" is what
    // consumers already fall back on, and the registry notifies them the moment it resolves.
    React.useMemo(() => {
      plugins.forEach((plugin: any) => {
        const namespace = String(plugin?.namespace || '').trim();
        const slug = String(plugin?.slug || '').trim();
        if (!namespace || !slug || hasPluginApi(namespace, slug)) {
          return;
        }

        if (loadsPluginRuntimes && PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime(plugin)) {
          return;
        }

        const client = new ApiScopeClient(stableApiBridge, ApiPathUtils.pluginPath(slug));
        registerPluginApi(namespace, slug, client);
      });
    }, [hasPluginApi, loadsPluginRuntimes, plugins, registerPluginApi, stableApiBridge]);
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
        getIcon: (name: string) => FrameworkIcons.getIcon(name),
        FrameworkIconRegistry,
        FrameworkIcons,
        IconNames: FrameworkIcons.iconNames(),
        createProxyIcon: (name: string) => FrameworkIcons.createProxyIcon(name),
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
