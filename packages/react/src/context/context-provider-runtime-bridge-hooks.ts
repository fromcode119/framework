import { ClientType } from '@fromcode119/core/client';
import React from 'react';
// reactor is the OOP base layer; plugins may only import @fromcode119/sdk, so its surface is
// republished through this bridge. Imported statically — a require() here is interop-shimmed by
// Turbopack in the browser bundle and broke module evaluation.
import { Reactor, PureReactor, Provider, Bridge, Enum, Context, prop, state, bound, watch, ref } from '@fromcode119/reactor';
import { ApiPathUtils, ApiScopeClient, ApiVersionUtils, CoercionUtils, CollectionUtils, FormatUtils, HookEventUtils, LocalizationUtils, NumberUtils, PaginationUtils, PluginFrontendRuntimeUtils, RelationUtils, RuntimeConstants, StringUtils } from '@fromcode119/core/client';
import { BrowserLocalization } from '@react/browser-localization';
import { CollectionQueryUtils } from '@react/collection-queries';
import { ContextRuntimeBridge } from '@react/context-runtime-bridge';
import { FrameworkIconRegistry } from '@react/icons/framework-icon-registry';
import { AccountShellPlaceholder } from '@react/account/account-shell-placeholder';
import { AccountShellSkeleton } from '@react/account/account-shell-skeleton';
import { Platform } from '@fromcode119/reactor';
import { SlotsContext } from '@react/context/slots-context';
import { AccountShellDefault } from '@react/account/account-shell-default';
import { AccountSectionRegistry } from '@react/account/account-section-registry';
import { AccountSection } from '@react/account/account-section';
import { AccountSectionIcons } from '@react/account/account-section-icons';
import { AccountClass } from '@react/account/account-class';
import { FrameworkIcons } from '@react/icons/view/framework-icons.client';
import { RootFramework } from '@react/root-framework';
import { SystemShortcodes } from '@react/system-shortcodes';
import { ContextBridgeHooks } from '@react/context/context-bridge-hooks';

export class ContextProviderRuntimeBridgeHooks {
  /**
   * A route-level shell, code-split and memoised per loader.
   *
   * Memoised because the bridge is reinstalled whenever its dependencies change, and a fresh
   * `React.lazy` on every install is a NEW component type — React would unmount and remount whatever a
   * theme had rendered with the previous one, which for `/account` means losing the panel's state.
   */
  private static readonly lazyShells = new Map<string, unknown>();

  /**
   * A code-split shell, wrapped in the Suspense boundary it needs plus a fallback that has the shell's
   * SHAPE. Without a fallback the boundary renders nothing — on the server (which cannot resolve a
   * dynamic import mid-render) and in the window before the chunk lands — which is what left an account
   * URL showing a navbar, a footer and a hole. `Fallback` keeps the page structurally complete
   * throughout, so nothing moves when the real shell arrives.
   */
  private static lazyShell(
    loader: () => Promise<{ default: unknown }>,
    Fallback?: React.ComponentType<any>,
  ): unknown {
    const key = String(loader);
    const cached = ContextProviderRuntimeBridgeHooks.lazyShells.get(key);
    if (cached) return cached;
    const Lazy = React.lazy(loader as never) as unknown as React.ComponentType<any>;
    const Shell = (props: any) => (
      React.createElement(
        React.Suspense,
        { fallback: Fallback ? React.createElement(Fallback, props) : null },
        React.createElement(Lazy, props),
      )
    );
    ContextProviderRuntimeBridgeHooks.lazyShells.set(key, Shell);
    return Shell;
  }

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
    clientType: ClientType;
    plugins: any[];
    hasPluginApi: (namespace: string, slug: string) => boolean;
    registerPluginApi: (namespace: string, slug: string, client: any) => void;
    stableApiBridge: any;
  }) {
    const { clientType, plugins, hasPluginApi, registerPluginApi, stableApiBridge } = args;
    const loadsPluginRuntimes = clientType === ClientType.FRONTEND_UI;

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
      const Slot = require('@react/slot').Slot;
      const Override = require('@react/view/override.client').Override;
      // LAZY on purpose. A literal `require()` is a STATIC dependency to the bundler even inside an
      // effect, so these three shipped in the storefront's first chunk — ~400 KB of account/auth/records
      // UI parsed and evaluated on a product page that renders none of it, which is what the LCP
      // "render delay" phase was mostly made of. They are only ever rendered by a theme layout inside a
      // Suspense boundary (`/account`, `/login`), which is exactly what `React.lazy` needs.
      const AccountShell = ContextProviderRuntimeBridgeHooks.lazyShell(
        () => import('@react/account-shell').then((m) => ({ default: m.AccountShell })),
        AccountShellPlaceholder,
      );
      const AuthShell = ContextProviderRuntimeBridgeHooks.lazyShell(
        () => import('@react/auth/auth-shell').then((m) => ({ default: m.AuthShell })),
      );
      const RecordsHub = ContextProviderRuntimeBridgeHooks.lazyShell(
        () => import('@react/records-hub').then((m) => ({ default: m.RecordsHub })),
      );
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
        AccountShellSkeleton,
        AccountShellPlaceholder,
        SlotsContext,
        Platform,
        AccountShellDefault,
        AccountSectionRegistry,
        AccountSection,
        AccountSectionIcons,
        AccountClass,
        AuthShell,
        RecordsHub,
        Reactor,
        PureReactor,
        Provider,
        Bridge,
        Enum,
        Context,
        prop,
        state,
        bound,
        watch,
        ref,
        ReactRef: React,
        ReactDOMRef: ReactDOM,
        runtimeModules,
        stabilityRef,
      });
    }, [apiUrl, emit, getPluginApi, hasPluginApi, isReady, on, providerClass, registerCollection, registerContentTransformer, registerFieldComponent, registerMenuItem, registerOverride, registerPluginApi, registerPlugins, registerSettings, registerSlotComponent, registerTheme, registerTranslations, replaceCollections, replaceMenuItems, runtimeModules, setPluginState, stableApiBridge, stableGetFrontendMetadata, stableLoadConfig, stableT, setLocale, stabilityRef]);
  }
}
