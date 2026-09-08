import { Platform, ReactDomRoots } from '@fromcode119/reactor';
import { RuntimeRegistryAccess } from '@fromcode119/core/client';
import type { IGlobalStubSetupArgs } from '@react/interfaces/global-stub-setup-args.interface';
import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';
import { ContextBridge } from '@react/context-bridge';
import { AdminExportSourceBuilder } from '@react/helpers/admin-export-source-builder';
import { BridgeObjectBuilder } from '@react/helpers/bridge-object-builder';
import { ImportMapInstaller } from '@react/helpers/import-map-installer';
import { LucideNamespaceProxy } from '@react/icons/lucide-namespace-proxy';
import { ReactExportSourceBuilder } from '@react/helpers/react-export-source-builder';
import { SdkExportSourceBuilder } from '@react/helpers/sdk-export-source-builder';
import { LazyLoadClass } from '@react/lazy-load-class';
import { PreBootApiBridge } from '@react/helpers/pre-boot-api-bridge';
import { PreBootRegistrationSeed } from '@react/context/pre-boot-registration-seed';

export class ContextRuntimeBridge {
  static setupGlobalStubs(args: IGlobalStubSetupArgs): void {
    if (!Platform.isBrowser) return;

    // Single runtime handoff: React, ReactDOM, the Lucide proxy, and the (stub) bridge all live
    // under the ONE namespaced registry. Populating it here — during the pre-boot stub phase —
    // is what lets every import-map data-URL module read the registry directly, with no
    // `window.Fromcode` fallback: the registry is the source at both stub-time and install-time.
    const registry = RuntimeRegistryAccess.ensure();
    registry[RuntimeRegistryAccess.KEYS.REACT] = args.ReactRef;
    registry[RuntimeRegistryAccess.KEYS.JSX_RUNTIME] = RuntimeRegistryAccess.jsxRuntimeFor(args.ReactRef);
    registry[RuntimeRegistryAccess.KEYS.REACT_DOM] = ContextRuntimeBridge.reactDomEntry(args.ReactDOMRef);
    registry[RuntimeRegistryAccess.KEYS.LUCIDE] = LucideNamespaceProxy.create(args.getIcon);

    const fc = (registry[RuntimeRegistryAccess.KEYS.REACT_BRIDGE] ||= {});
    registry[RuntimeRegistryAccess.KEYS.SDK] = fc;
    registry[RuntimeRegistryAccess.KEYS.SDK_REACT] = fc;
    fc.React = args.ReactRef;
    fc.ReactDOM = args.ReactDOMRef;
    fc.ReactDom = args.ReactDOMRef;

    const queueMethod = (type: string) => (...methodArgs: any[]) => {
      const target = window as unknown as Record<string, any>;
      (target[PreBootRegistrationSeed.QUEUE_KEY] ||= []).push({ type, args: methodArgs });
    };

    // Queue stubs via class-based namespace.
    // Replaced with real implementations when installRuntimeBridge() is called.
    if (!fc.ContextBridge) {
      fc.ContextBridge = {
        registerContentTransformer: queueMethod('contentTransformer'),
        registerSlotComponent: queueMethod('slot'),
        registerFieldComponent: queueMethod('field'),
        registerOverride: queueMethod('override'),
        registerMenuItem: queueMethod('menuItem'),
        registerCollection: queueMethod('collection'),
        registerTheme: queueMethod('theme'),
        registerSettings: queueMethod('settings'),
        registerTranslations: queueMethod('translations'),
        emit: queueMethod('emit'),
        on: queueMethod('on'),
      };
    }

    if (!fc.ContextHooks) {
      fc.ContextHooks = {
        usePlugins: () => ({ data: [], isLoading: false }),
        useTranslation: () => ({ t: (k: string) => k }),
        usePluginState: () => [null, () => {}],
        useSystemShortcodes: () => ({}),
      };
    }

    if (!fc.InteractiveCanvas) {
      fc.InteractiveCanvas = {
        Provider: ({ children }: any) => children,
        Wrapper: ({ children }: any) => children,
        Consumer: ({ children }: any) => children({ state: { isEnabled: false, targetId: null }, toggleEnabled: () => {}, setTargetId: () => {} }),
        use: () => ({ state: { isEnabled: false, targetId: null }, toggleEnabled: () => {}, setTargetId: () => {} }),
      };
    }

    fc.getIcon = args.getIcon;
    fc.FrameworkIcons = args.FrameworkIcons;
    fc.FrameworkIconRegistry = args.FrameworkIconRegistry;
    fc.IconNames = args.IconNames;
    fc.createProxyIcon = args.createProxyIcon;
  }

  /**
   * The LIVE install, from the mounted provider's effect: the bridge with the provider's closures, then
   * the pre-boot queue replayed into them. Also releases every API request made against the pre-boot
   * bridge (see `PreBootApiBridge`).
   */
  static installRuntimeBridge(args: IRuntimeBridgeInstallArgs): void {
    if (!Platform.isBrowser) return;
    ContextRuntimeBridge.installBridge(args);
    PreBootApiBridge.resolve(args.stableApiBridge);
    ContextRuntimeBridge.flushQueue();
  }

  /**
   * The PRE-BOOT install (islands runtime): the FULL bridge — every SDK class, reactor's surface, the
   * icons, the shells, the import map — before any provider exists, so theme and plugin bundles can
   * evaluate first. Its registration methods write the pre-boot queue, which the runtime folds into the
   * provider's seed and the live install flushes for the rest; nothing is replayed here. The queue is
   * created up front so `PreBootRegistrationSeed.consume` always finds an array.
   */
  static installPreBootBridge(args: IRuntimeBridgeInstallArgs): void {
    if (!Platform.isBrowser) return;
    const target = window as unknown as Record<string, any>;
    target[PreBootRegistrationSeed.QUEUE_KEY] ||= [];
    ContextRuntimeBridge.installBridge(args);
  }

  /** Shared by both installs: ContextBridge args, the ONE runtime registry, the import map. */
  private static installBridge(args: IRuntimeBridgeInstallArgs): void {
    if (args.apiUrl) (window as any).FROMCODE_API_URL = args.apiUrl;

    // Install args into ContextBridge so its static methods delegate to live implementations.
    ContextBridge.install(args);

    const bridge = BridgeObjectBuilder.build(args);
    // The ONE runtime handoff surface. The real bridge replaces the stub written in
    // setupGlobalStubs; React, ReactDOM, and the Lucide proxy live under the same registry.
    const runtimeRegistry = RuntimeRegistryAccess.ensure();
    runtimeRegistry[RuntimeRegistryAccess.KEYS.REACT_BRIDGE] = bridge;
    runtimeRegistry[RuntimeRegistryAccess.KEYS.SDK] = bridge;
    runtimeRegistry[RuntimeRegistryAccess.KEYS.SDK_REACT] = bridge;
    runtimeRegistry[RuntimeRegistryAccess.KEYS.REACT] = args.ReactRef;
    runtimeRegistry[RuntimeRegistryAccess.KEYS.JSX_RUNTIME] = RuntimeRegistryAccess.jsxRuntimeFor(args.ReactRef);
    runtimeRegistry[RuntimeRegistryAccess.KEYS.REACT_DOM] = ContextRuntimeBridge.reactDomEntry(args.ReactDOMRef);
    runtimeRegistry[RuntimeRegistryAccess.KEYS.LUCIDE] = LucideNamespaceProxy.create(args.getIcon);

    // Assign LazyLoadClass through an explicit window property chain so webpack cannot tree-shake it —
    // a property assignment on a local var that merely escapes via window can be elided by webpack.
    (window as any)[RuntimeRegistryAccess.globalName][RuntimeRegistryAccess.KEYS.REACT_BRIDGE].LazyLoadClass =
      LazyLoadClass;

    ContextRuntimeBridge.installImportMap(args, bridge, runtimeRegistry);
  }

  private static installImportMap(
    args: IRuntimeBridgeInstallArgs,
    bridge: Record<string, unknown>,
    runtimeRegistry: Record<string, any>,
  ): void {
    const reactModuleAccessor =
      `window.${args.RuntimeConstants.GLOBALS.MODULES} && window.${args.RuntimeConstants.GLOBALS.MODULES}['@fromcode119/react']`;
    const adminExportSource = AdminExportSourceBuilder.build(args, runtimeRegistry);
    const reactExportSource = ReactExportSourceBuilder.buildReactExportSource(bridge, reactModuleAccessor);
    const sdkReactExportSource = ReactExportSourceBuilder.buildSdkReactExportSource(reactModuleAccessor);
    const sdkExportSource = SdkExportSourceBuilder.build(reactModuleAccessor);
    ImportMapInstaller.install(
      args,
      { adminExportSource, reactExportSource, sdkReactExportSource, sdkExportSource },
      runtimeRegistry,
    );
  }

  /**
   * Queue item type → the `ContextBridge` method that replays it. The legacy item shapes (`name`/`comp`,
   * `item`, `collection`, …) predate `args` on the queue and are still accepted.
   */
  private static readonly QUEUE_DISPATCH: Record<string, { method: keyof typeof ContextBridge; legacy: (item: any) => unknown[] }> = {
    contentTransformer: { method: 'registerContentTransformer', legacy: () => [] },
    slot: { method: 'registerSlotComponent', legacy: (item) => [item.name, item.comp] },
    field: { method: 'registerFieldComponent', legacy: (item) => [item.name, item.component] },
    override: { method: 'registerOverride', legacy: (item) => [item.name, item.component] },
    menuItem: { method: 'registerMenuItem', legacy: (item) => [item.item] },
    replaceMenuItems: { method: 'replaceMenuItems', legacy: () => [] },
    collection: { method: 'registerCollection', legacy: (item) => [item.collection] },
    replaceCollections: { method: 'replaceCollections', legacy: () => [] },
    plugins: { method: 'registerPlugins', legacy: () => [] },
    theme: { method: 'registerTheme', legacy: (item) => [item.slug, item.config] },
    settings: { method: 'registerSettings', legacy: (item) => [item.settings] },
    // `item.args` carries the layer argument too, so a queued theme registration replays into the same
    // bucket it would have gone to had the bridge been installed.
    translations: { method: 'registerTranslations', legacy: (item) => [item.translations] },
    pluginApi: { method: 'registerPluginApi', legacy: () => [] },
    pluginState: { method: 'setPluginState', legacy: () => [] },
    emit: { method: 'emit', legacy: () => [] },
    on: { method: 'on', legacy: () => [] },
  };

  private static flushQueue(): void {
    const target = window as unknown as Record<string, any>;
    const queue = target[PreBootRegistrationSeed.QUEUE_KEY];
    if (!queue) return;
    delete target[PreBootRegistrationSeed.QUEUE_KEY];

    (queue as any[]).forEach((item: any) => {
      const dispatch = ContextRuntimeBridge.QUEUE_DISPATCH[String(item?.type)];
      if (!dispatch) return;
      try {
        (ContextBridge[dispatch.method] as (...args: unknown[]) => unknown)(...(item.args || dispatch.legacy(item)));
      } catch (error) {
        console.error(`[Fromcode] Failed to flush queued item of type ${item.type}:`, error);
      }
    });
  }

  /**
   * The registry's `react-dom` module. React 19's `react-dom` no longer exports the root factories
   * (`createRoot` / `hydrateRoot` live in `react-dom/client`), but the import map's `react-dom` module
   * destructures them from this entry, so a runtime bundle mounting its own root would read `undefined`.
   * The one bundled react-dom supplies them, through reactor's single door to raw React values.
   */
  private static reactDomEntry(reactDom: any): any {
    return { ...reactDom, createRoot: ReactDomRoots.createRoot, hydrateRoot: ReactDomRoots.hydrateRoot };
  }
}
