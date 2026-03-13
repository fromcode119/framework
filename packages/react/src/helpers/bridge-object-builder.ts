import type { RuntimeBridgeInstallArgs } from '../context-runtime-bridge.interfaces';

export class BridgeObjectBuilder {
  static build(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      ...BridgeObjectBuilder.buildIconRefs(args),
      ...BridgeObjectBuilder.buildRegisterMethods(args),
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
      Loader2: args.getIcon('Loader2'),
      Search: args.getIcon('Search'),
      Plus: args.getIcon('Plus'),
      Trash2: args.getIcon('Trash'),
      Pencil: args.getIcon('Edit'),
      Save: args.getIcon('Save'),
      Download: args.getIcon('Download'),
      Upload: args.getIcon('Upload'),
      RefreshCw: args.getIcon('Refresh'),
      ExternalLink: args.getIcon('External'),
      MoreHorizontal: args.getIcon('More'),
      Filter: args.getIcon('Filter'),
      FileText: args.getIcon('FileText'),
      Tag: args.getIcon('Tag'),
      Layers: args.getIcon('Layers'),
      ChevronDown: args.getIcon('Down'),
      ChevronRight: args.getIcon('Right'),
      Home: args.getIcon('Home'),
      Info: args.getIcon('Info'),
      AlertCircle: args.getIcon('Alert'),
      CheckCircle2: args.getIcon('Check'),
      MoreVertical: args.getIcon('MoreVertical'),
      Layout: args.getIcon('Layout'),
      Columns: args.getIcon('Columns'),
      Copy: args.getIcon('Copy'),
      Settings: args.getIcon('settings'),
      BarChart3: args.getIcon('BarChart3'),
      PlusCircle: args.getIcon('PlusCircle'),
      File: args.getIcon('File'),
      Film: args.getIcon('Film'),
    };
  }

  private static buildRegisterMethods(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      registerSlotComponent: args.registerSlotComponent,
      registerFieldComponent: args.registerFieldComponent,
      registerOverride: args.registerOverride,
      registerMenuItem: args.registerMenuItem,
      registerCollection: args.registerCollection,
      registerPlugins: args.registerPlugins,
      registerTheme: args.registerTheme,
      registerSettings: args.registerSettings,
      registerAPI: args.registerAPI,
      getAPI: args.getAPI,
      setPluginState: args.setPluginState,
      loadConfig: args.stableLoadConfig,
      getFrontendMetadata: args.stableGetFrontendMetadata,
      emit: args.emit,
      on: args.on,
      t: args.stableT,
      api: args.stableApiBridge,
      locale: () => args.stabilityRef.current.locale,
      setLocale: args.setLocale,
      usePlugins: args.usePlugins,
      useTranslation: args.useTranslation,
      usePluginAPI: args.usePluginAPI,
      usePluginState: args.usePluginState,
      useSystemShortcodes: args.useSystemShortcodes,
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
      },
      PluginsProvider: args.PluginsProvider,
    };
  }
}
