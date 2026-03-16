import type { RuntimeBridgeInstallArgs } from '../context-runtime-bridge.interfaces';
import { ContextBridge } from '../context-bridge';
import { ContextHooks } from '../context-hooks';
import { SystemShortcodes } from '../system-shortcodes';

export class BridgeObjectBuilder {
  // buildRegisterMethods() is REMOVED — ContextBridge now owns args directly via
  // ContextBridge.install(), called from ContextRuntimeBridge.installRuntimeBridge().
  static build(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      ...BridgeObjectBuilder.buildIconRefs(args),
      ...BridgeObjectBuilder.buildCoercionAliases(args),
      ...BridgeObjectBuilder.buildUtilRefs(args),
    };
  }

  private static buildIconRefs(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      React: args.ReactRef,
      ReactDOM: args.ReactDOMRef,
      ReactDom: args.ReactDOMRef,
      Slot: args.Slot,
      Override: args.Override,
      getIcon: args.getIcon,
      IconRegistry: args.FrameworkIconRegistry,
      FrameworkIconRegistry: args.FrameworkIconRegistry,
      FrameworkIcons: args.FrameworkIcons,
      IconNames: args.IconNames,
      createProxyIcon: args.createProxyIcon,
      RootFramework: args.RootFramework,
    };
  }

  private static buildCoercionAliases(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      // ── Utility Classes Only (class-based architecture) ──
      CollectionQueryUtils: args.CollectionQueryUtils,
      BrowserLocalization: args.BrowserLocalization,
      CoercionUtils: args.CoercionUtils,
      LocalizationUtils: args.LocalizationUtils,
      RelationUtils: args.RelationUtils,
    };
  }

  private static buildUtilRefs(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      // ── Actual Classes (exported directly — not proxy objects) ──
      ContextBridge,
      ContextHooks,
      SystemShortcodes,
      // ── Utility Classes Only (class-based architecture) ──
      StringUtils: args.StringUtils,
      NumberUtils: args.NumberUtils,
      FormatUtils: args.FormatUtils,
      ApiVersionUtils: args.ApiVersionUtils,
      CollectionUtils: args.CollectionUtils,
      PaginationUtils: args.PaginationUtils,
      HookEventUtils: args.HookEventUtils,
      // ── Framework APIs ──
      RuntimeBridge: {
        isReady: args.isReady,
        getState: () => args.stabilityRef.current,
        getMetadata: args.stableGetFrontendMetadata,
      },
      PluginsProvider: args.PluginsProvider,
    };
  }
}
