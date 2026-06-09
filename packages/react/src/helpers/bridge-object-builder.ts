import type { RuntimeBridgeInstallArgs } from '../context-runtime-bridge.interfaces';
import { AsyncDataController } from '../async-data-controller';
import {
  AdminGlobalClient,
  AdminResourceClient,
  AdminSdkClient,
  AdminUserClient,
  ApplicationUrlUtils,
  ApiPathUtils,
  ApiQueryUtils,
  ApiRequestError,
  ApiRequestService,
  ApiScopeClient,
  BaseController,
  BaseRepository,
  BaseService,
  BrowserStateClient,
  BrowserStateRuntimeBuilder,
  CapabilityRegistry,
  ClientRuntimeConstants,
  CollectionScopeClient,
  CollectionUtils,
  CoercionUtils,
  InteractiveCanvas,
  LiveBlocks,
  LocalizedField,
  PublicSettings,
  CoreServices,
  CookieConstants,
  DataSourceConstants,
  EnvConfig,
  FormatUtils,
  HookEventUtils,
  IntegrationRegistry,
  LocalizationUtils,
  Logger,
  LogLevel,
  MediaRelationService,
  MiddlewareStage,
  NamespacedPluginsFacade,
  NumberUtils,
  PaginationUtils,
  PluginFrontendLayoutRegistrar,
  PluginCapability,
  PluginDefinitionUtils,
  Plugins,
  PluginsFacade,
  PluginsRegistry,
  PublicAssetUrlUtils,
  PublicRouteConstants,
  RecordVersions,
  RelationUtils,
  RouteConstants,
  AccountRouteUtils,
  RouteUtils,
  RuntimeBridge,
  RuntimeLocationUtils,
  RuntimeConstants,
  SettingsScopeClient,
  SdkClient,
  ShortcodeUtils,
  StringUtils,
  SystemAuthClient,
  SystemAuthSession,
  SystemConstants,
  ThemeFrontendLayoutRegistrar,
  UrlUtils,
  ApiVersionUtils,
} from '@fromcode119/core/client';
import { ContextBridge } from '../context-bridge';
import { ContextHooks } from '../context-hooks';
import { ThemeOverrideRegistrar } from '../theme-override-registrar';
import { LazyComponentLoaderService } from '../lazy-component-loader-service';
import { LazyLoadClass } from '../lazy-load-class';
import { PageStyleContext } from '../page-style-context';
import { PageStyleProvider } from '../page-style-provider';
import { PageStyleHooks } from '../page-style-hooks';
import { SystemShortcodes } from '../system-shortcodes';
import { PluginRuntimeContext } from '../plugin-runtime-context';
import { PluginRuntimeProvider } from '../plugin-runtime-provider';
import { PluginComponent } from '../plugin-component';

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
      AccountShell: args.AccountShell,
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
      AsyncDataController,
      LazyComponentLoaderService,
      LazyLoadClass,
      PluginsProvider: args.PluginsProvider,
      CollectionQueryUtils: args.CollectionQueryUtils,
      BrowserLocalization: args.BrowserLocalization,
      PageStyleContext,
      PageStyleProvider,
      PageStyleHooks,
      PluginRuntimeContext,
      PluginRuntimeProvider,
      PluginComponent,
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
      BrowserStateClient,
      BrowserStateRuntimeBuilder,
      SystemAuthClient,
      SystemAuthSession,
      Plugins,
      PluginsFacade,
      NamespacedPluginsFacade,
      PluginsRegistry,
      RouteUtils,
      UrlUtils,
      ApplicationUrlUtils,
      RuntimeLocationUtils,
      PublicAssetUrlUtils,
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
      MediaRelationService,
      SystemConstants,
      ClientRuntimeConstants,
      CookieConstants,
      RuntimeConstants,
      RouteConstants,
      AccountRouteUtils,
      PublicRouteConstants,
      DataSourceConstants,
      Logger,
      LogLevel,
      EnvConfig,
      CapabilityRegistry,
      IntegrationRegistry,
      PluginFrontendLayoutRegistrar,
      ThemeFrontendLayoutRegistrar,
      ThemeOverrideRegistrar,
      RecordVersions,
      PluginCapability,
      MiddlewareStage,
      InteractiveCanvas,
      LiveBlocks,
      LocalizedField,
      PublicSettings,
    };
  }
}
