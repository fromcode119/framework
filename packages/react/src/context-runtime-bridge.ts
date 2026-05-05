import * as LucideAllIcons from 'lucide-react';
import type { GlobalStubSetupArgs, RuntimeBridgeInstallArgs } from './context-runtime-bridge.interfaces';
import { ContextBridge } from './context-bridge';
import { AdminExportSourceBuilder } from './helpers/admin-export-source-builder';
import { BridgeObjectBuilder } from './helpers/bridge-object-builder';
import { ImportMapInstaller } from './helpers/import-map-installer';
import { ReactExportSourceBuilder } from './helpers/react-export-source-builder';
import { SdkExportSourceBuilder } from './helpers/sdk-export-source-builder';
import { LazyLoadClass } from './lazy-load-class';

export class ContextRuntimeBridge {
  static setupGlobalStubs(args: GlobalStubSetupArgs): void {
    if (typeof window === 'undefined') return;

    if (!(window as any).Fromcode) {
      (window as any).Fromcode = {};
    }

    const fc = (window as any).Fromcode;
    fc.React = args.ReactRef;
    fc.ReactDOM = args.ReactDOMRef;
    fc.ReactDom = args.ReactDOMRef;

    (window as any).React = args.ReactRef;
    (window as any).ReactDOM = args.ReactDOMRef;
    (window as any).ReactDom = args.ReactDOMRef;
    (window as any).FrameworkIcons = args.FrameworkIcons;
    (window as any).FrameworkIconRegistry = args.FrameworkIconRegistry;
    (window as any).Lucide = LucideAllIcons;

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

    fc.getIcon = args.getIcon;
    fc.FrameworkIcons = args.FrameworkIcons;
    (window as any).FrameworkIcons = args.FrameworkIcons;
    fc.FrameworkIconRegistry = args.FrameworkIconRegistry;
    fc.IconNames = args.IconNames;
    fc.createProxyIcon = args.createProxyIcon;
  }

  static installRuntimeBridge(args: RuntimeBridgeInstallArgs): void {
    if (typeof window === 'undefined') return;
    if (args.apiUrl) (window as any).FROMCODE_API_URL = args.apiUrl;

    // Install args into ContextBridge so its static methods delegate to live implementations.
    ContextBridge.install(args);

    const bridge = BridgeObjectBuilder.build(args);
    const runtimeRegistry = ((window as any)[args.RuntimeConstants.GLOBALS.MODULES] ||= {});
    runtimeRegistry['@fromcode119/react'] = bridge;
    runtimeRegistry['@fromcode119/sdk'] = bridge;
    runtimeRegistry['@fromcode119/sdk/react'] = bridge;

    (window as any).Fromcode = bridge;
    // Write LazyLoadClass to window.Fromcode (a global) so webpack cannot tree-shake it.
    // bridge.LazyLoadClass is skipped here because property assignments on a local var
    // that escapes via window can be elided by webpack's object-property analysis.
    (window as any).Fromcode.LazyLoadClass = LazyLoadClass;
    (window as any).getIcon = args.getIcon;
    (window as any).FrameworkIcons = args.FrameworkIcons;
    (window as any).FrameworkIconRegistry = args.FrameworkIconRegistry;
    (window as any).Lucide = LucideAllIcons;
    (window as any).React = args.ReactRef;
    (window as any).ReactDOM = args.ReactDOMRef;
    (window as any).ReactDom = args.ReactDOMRef;

    ContextRuntimeBridge.installImportMap(args, bridge, runtimeRegistry);
    ContextRuntimeBridge.flushQueue(args);
  }

  private static installImportMap(
    args: RuntimeBridgeInstallArgs,
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

  private static flushQueue(_args: RuntimeBridgeInstallArgs): void {
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
