import { Platform } from '@fromcode119/reactor';
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
    registry[RuntimeRegistryAccess.KEYS.REACT_DOM] = args.ReactDOMRef;
    registry[RuntimeRegistryAccess.KEYS.LUCIDE] = LucideNamespaceProxy.create(args.getIcon);

    const fc = (registry[RuntimeRegistryAccess.KEYS.REACT_BRIDGE] ||= {});
    registry[RuntimeRegistryAccess.KEYS.SDK] = fc;
    registry[RuntimeRegistryAccess.KEYS.SDK_REACT] = fc;
    fc.React = args.ReactRef;
    fc.ReactDOM = args.ReactDOMRef;
    fc.ReactDom = args.ReactDOMRef;

    const queueMethod = (type: string) => (...methodArgs: any[]) => {
      if (!(window as any)._fromcodeQueue) (window as any)._fromcodeQueue = [];
      (window as any)._fromcodeQueue.push({ type, args: methodArgs });
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

  static installRuntimeBridge(args: IRuntimeBridgeInstallArgs): void {
    if (!Platform.isBrowser) return;
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
    runtimeRegistry[RuntimeRegistryAccess.KEYS.REACT_DOM] = args.ReactDOMRef;
    runtimeRegistry[RuntimeRegistryAccess.KEYS.LUCIDE] = LucideNamespaceProxy.create(args.getIcon);

    // Assign LazyLoadClass through an explicit window property chain so webpack cannot tree-shake it —
    // a property assignment on a local var that merely escapes via window can be elided by webpack.
    (window as any)[RuntimeRegistryAccess.globalName][RuntimeRegistryAccess.KEYS.REACT_BRIDGE].LazyLoadClass =
      LazyLoadClass;

    ContextRuntimeBridge.installImportMap(args, bridge, runtimeRegistry);
    ContextRuntimeBridge.flushQueue(args);
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

  private static flushQueue(_args: IRuntimeBridgeInstallArgs): void {
    if (!(window as any)._fromcodeQueue) return;

    const queue = (window as any)._fromcodeQueue;
    delete (window as any)._fromcodeQueue;

    queue.forEach((item: any) => {
      try {
        switch (item.type) {
          case 'contentTransformer':
            ContextBridge.registerContentTransformer(...(item.args || []));
            break;
          case 'slot':
            ContextBridge.registerSlotComponent(...(item.args || [item.name, item.comp]));
            break;
          case 'field':
            ContextBridge.registerFieldComponent(...(item.args || [item.name, item.component]));
            break;
          case 'override':
            ContextBridge.registerOverride(...(item.args || [item.name, item.component]));
            break;
          case 'menuItem':
            ContextBridge.registerMenuItem(...(item.args || [item.item]));
            break;
          case 'collection':
            ContextBridge.registerCollection(...(item.args || [item.collection]));
            break;
          case 'theme':
            ContextBridge.registerTheme(...(item.args || [item.slug, item.config]));
            break;
          case 'settings':
            ContextBridge.registerSettings(...(item.args || [item.settings]));
            break;
          case 'translations':
            ContextBridge.registerTranslations(...(item.args || [item.translations]));
            break;
          case 'emit':
            ContextBridge.emit(...(item.args || []));
            break;
          case 'on':
            ContextBridge.on(...(item.args || []));
            break;
        }
      } catch (error) {
        console.error(`[Fromcode] Failed to flush queued item of type ${item.type}:`, error);
      }
    });
  }
}
