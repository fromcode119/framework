import type { RuntimeBridgeInstallArgs } from '../context-runtime-bridge.interfaces';
import {
  AdminGlobalClient,
  AdminResourceClient,
  AdminSdkClient,
  AdminUserClient,
  ApiPathUtils,
  ApiQueryUtils,
  ApiRequestError,
  ApiRequestService,
  ApiScopeClient,
  BaseController,
  BaseRepository,
  BaseService,
  CapabilityRegistry,
  CollectionScopeClient,
  CollectionUtils,
  CoercionUtils,
  CoreServices,
  DataSourceConstants,
  EnvConfig,
  FormatUtils,
  HookEventUtils,
  IntegrationRegistry,
  LocalizationUtils,
  Logger,
  LogLevel,
  MiddlewareStage,
  NamespacedPluginsFacade,
  NumberUtils,
  PaginationUtils,
  PluginCapability,
  PluginDefinitionUtils,
  Plugins,
  PluginsFacade,
  PluginsRegistry,
  PublicRouteConstants,
  RecordVersions,
  RelationUtils,
  RouteConstants,
  RouteUtils,
  RuntimeBridge,
  RuntimeConstants,
  SettingsScopeClient,
  SdkClient,
  ShortcodeUtils,
  StringUtils,
  SystemConstants,
  UrlUtils,
  ApiVersionUtils,
} from '@fromcode119/core/client';
import { ContextBridge } from '../context-bridge';
import { ContextHooks } from '../context-hooks';
import { SystemShortcodes } from '../system-shortcodes';

export class BridgeObjectBuilder {
  // buildRegisterMethods() is REMOVED — ContextBridge now owns args directly via
  // ContextBridge.install(), called from ContextRuntimeBridge.installRuntimeBridge().
  static build(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      ...BridgeObjectBuilder.buildIconRefs(args),
      ...BridgeObjectBuilder.buildRuntimeStateRefs(args),
      ...BridgeObjectBuilder.buildUtilRefs(args),
      ...BridgeObjectBuilder.buildSdkRefs(),
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

  private static buildRuntimeStateRefs(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      getState: () => args.stabilityRef.current,
      loadConfig: args.stableLoadConfig,
      isReady: args.isReady,
      t: args.stableT,
    };
  }

  private static buildUtilRefs(args: RuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      ContextBridge,
      ContextHooks,
      SystemShortcodes,
      PluginsProvider: args.PluginsProvider,
      CollectionQueryUtils: args.CollectionQueryUtils,
      BrowserLocalization: args.BrowserLocalization,
    };
  }

  private static buildSdkRefs(): Record<string, unknown> {
    return {
      BaseRepository,
      BaseService,
      BaseController,
      CoercionUtils,
      StringUtils,
      NumberUtils,
      FormatUtils,
      ApiRequestError,
      ApiRequestService,
      ApiQueryUtils,
      ApiPathUtils,
      AdminUserClient,
      ApiScopeClient,
      CollectionScopeClient,
      SettingsScopeClient,
      SdkClient,
      AdminGlobalClient,
      AdminResourceClient,
      AdminSdkClient,
      Plugins,
      PluginsFacade,
      NamespacedPluginsFacade,
      PluginsRegistry,
      RouteUtils,
      UrlUtils,
      ApiVersionUtils,
      LocalizationUtils,
      CollectionUtils,
      HookEventUtils,
      PaginationUtils,
      RelationUtils,
      ShortcodeUtils,
      PluginDefinitionUtils,
      RuntimeBridge,
      CoreServices,
      SystemConstants,
      RuntimeConstants,
      RouteConstants,
      PublicRouteConstants,
      DataSourceConstants,
      Logger,
      LogLevel,
      EnvConfig,
      CapabilityRegistry,
      IntegrationRegistry,
      RecordVersions,
      PluginCapability,
      MiddlewareStage,
    };
  }
}
