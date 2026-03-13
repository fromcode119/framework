import * as LucideAllIcons from 'lucide-react';
import type { GlobalStubSetupArgs, RuntimeBridgeInstallArgs } from './context-runtime-bridge.interfaces';
import { AdminExportSourceBuilder } from './helpers/admin-export-source-builder';
import { BridgeObjectBuilder } from './helpers/bridge-object-builder';
import { ImportMapInstaller } from './helpers/import-map-installer';
import { ReactExportSourceBuilder } from './helpers/react-export-source-builder';
import { SdkExportSourceBuilder } from './helpers/sdk-export-source-builder';

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
      console.log(`[Fromcode] Queuing method: ${type}`, methodArgs);
      if (!(window as any)._fromcodeQueue) (window as any)._fromcodeQueue = [];
      (window as any)._fromcodeQueue.push({ type, args: methodArgs });
    };

    if (!fc.registerSlotComponent) fc.registerSlotComponent = queueMethod('slot');
    if (!fc.registerFieldComponent) fc.registerFieldComponent = queueMethod('field');
    if (!fc.registerOverride) fc.registerOverride = queueMethod('override');
    if (!fc.registerMenuItem) fc.registerMenuItem = queueMethod('menuItem');
    if (!fc.registerCollection) fc.registerCollection = queueMethod('collection');
    if (!fc.registerTheme) fc.registerTheme = queueMethod('theme');
    if (!fc.registerSettings) fc.registerSettings = queueMethod('settings');

    if (!fc.t) fc.t = (key: string, _params?: any, defaultValue?: string) => defaultValue || key;
    if (!fc.locale) fc.locale = 'en';

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

    const bridge = BridgeObjectBuilder.build(args);
    const runtimeRegistry = ((window as any)[args.RuntimeConstants.GLOBALS.MODULES] ||= {});
    runtimeRegistry['@fromcode119/react'] = bridge;
    runtimeRegistry['@fromcode119/sdk'] = bridge;
    runtimeRegistry['@fromcode119/sdk/react'] = bridge;

    (window as any).Fromcode = bridge;
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

  private static flushQueue(args: RuntimeBridgeInstallArgs): void {
    if (!(window as any)._fromcodeQueue) return;

    console.log(`[Fromcode] Flushing queue with ${(window as any)._fromcodeQueue.length} items`);
    const queue = (window as any)._fromcodeQueue;
    delete (window as any)._fromcodeQueue;

    queue.forEach((item: any) => {
      try {
        console.log(`[Fromcode] Processing queued item: ${item.type}`, item.args);
        switch (item.type) {
          case 'slot':
            (args.registerSlotComponent as any)(...(item.args || [item.name, item.comp]));
            break;
          case 'field':
            (args.registerFieldComponent as any)(...(item.args || [item.name, item.component]));
            break;
          case 'override':
            (args.registerOverride as any)(...(item.args || [item.name, item.component]));
            break;
          case 'menuItem':
            (args.registerMenuItem as any)(...(item.args || [item.item]));
            break;
          case 'collection':
            (args.registerCollection as any)(...(item.args || [item.collection]));
            break;
          case 'theme':
            (args.registerTheme as any)(...(item.args || [item.slug, item.config]));
            break;
          case 'settings':
            (args.registerSettings as any)(...(item.args || [item.settings]));
            break;
        }
      } catch (error) {
        console.error(`[Fromcode] Failed to flush queued item of type ${item.type}:`, error);
      }
    });
  }
}
