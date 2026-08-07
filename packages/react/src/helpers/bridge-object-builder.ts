import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';
import { AdminComponentRegistry } from '@react/admin-component-registry';
import { AsyncDataController } from '@react/async-data-controller';
import { AccountRouteUtils, AdminGlobalClient, AdminResourceClient, AdminSdkClient, AdminUserClient, ApiPathUtils, ApiQueryUtils, ApiRequestError, ApiRequestService, ApiScopeClient, ApiVersionUtils, ApplicationUrlUtils, BaseController, BaseRepository, BaseService, BrowserStateClient, BrowserStateRuntimeBuilder, CapabilityRegistry, ClientRuntimeConstants, CoercionUtils, CollectionScopeClient, CollectionUtils, CookieConstants, CoreServices, DataSourceConstants, FormatUtils, HookEventUtils, InteractiveCanvas, LayoutTargetKind, LiveBlocks, LocalizationUtils, LocalizedField, LogLevel, Logger, MeasurementSystemUtils, MediaRelationService, MiddlewareStage, NamespacedPluginsFacade, NumberUtils, PaginationUtils, PluginCapability, PluginFrontendLayoutRegistrar, Plugins, PluginsFacade, PluginsRegistry, PublicAssetUrlUtils, PublicRouteConstants, PublicSettings, RecordVersions, RelationUtils, RouteConstants, RouteUtils, RuntimeBridge, RuntimeConstants, RuntimeLocationUtils, SdkClient, SettingsScopeClient, ShortcodeUtils, StringUtils, SystemAuthClient, SystemAuthSession, SystemConstants, ThemeFrontendLayoutRegistrar, ThemeMode, UrlUtils, WidgetViewport } from '@fromcode119/core/client';
import { ContextBridge } from '@react/context-bridge';
import { PluginUiRegistrar } from '@react/plugin-ui-registrar';
import { ContextHooks } from '@react/context-hooks/context-hooks';
import { ThemeOverrideRegistrar } from '@react/theme-override-registrar';
import { LazyComponentLoaderService } from '@react/lazy-component-loader-service';
import { LazyLoadClass } from '@react/lazy-load-class';
import { PageStyleContext } from '@react/page-style-context';
import { PageStyleProvider } from '@react/page-style-provider';
import { PageStyleHooks } from '@react/page-style-hooks';
import { SystemShortcodes } from '@react/system-shortcodes';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import { PluginRuntimeProvider } from '@react/view/plugin-runtime-provider.client';
import { PluginComponent } from '@react/view/plugin-component.client';

export class BridgeObjectBuilder {
  // buildRegisterMethods() is REMOVED — ContextBridge now owns args directly via
  // ContextBridge.install(), called from ContextRuntimeBridge.installRuntimeBridge().
  static build(args: IRuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      ...BridgeObjectBuilder.buildIconRefs(args),
      ...BridgeObjectBuilder.buildRuntimeStateRefs(args),
      ...BridgeObjectBuilder.buildUtilRefs(args),
      ...BridgeObjectBuilder.buildSdkRefs(),
    };
  }

  private static buildIconRefs(args: IRuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      React: args.ReactRef,
      ReactDOM: args.ReactDOMRef,
      ReactDom: args.ReactDOMRef,
      Slot: args.Slot,
      Override: args.Override,
      AccountShell: args.AccountShell,
      SlotsContext: args.SlotsContext,
      Platform: args.Platform,
      AccountShellDefault: args.AccountShellDefault,
      AccountSectionRegistry: args.AccountSectionRegistry,
      AccountSection: args.AccountSection,
      AccountSectionIcons: args.AccountSectionIcons,
      AccountShellSkeleton: args.AccountShellSkeleton,
      AccountShellPlaceholder: args.AccountShellPlaceholder,
      AccountClass: args.AccountClass,
      AuthMode: args.AuthMode,
      AuthShell: args.AuthShell,
      RecordsHub: args.RecordsHub,
      ReactPrimitives: args.ReactPrimitives,
      Reactor: args.Reactor,
      PureReactor: args.PureReactor,
      Provider: args.Provider,
      Bridge: args.Bridge,
      Enum: args.Enum,
      Context: args.Context,
      prop: args.prop,
      state: args.state,
      bound: args.bound,
      watch: args.watch,
      ref: args.ref,

      getIcon: args.getIcon,
      IconRegistry: args.FrameworkIconRegistry,
      FrameworkIconRegistry: args.FrameworkIconRegistry,
      FrameworkIcons: args.FrameworkIcons,
      IconNames: args.IconNames,
      createProxyIcon: args.createProxyIcon,
      RootFramework: args.RootFramework,
    };
  }

  private static buildRuntimeStateRefs(args: IRuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      getState: () => args.stabilityRef.current,
      loadConfig: args.stableLoadConfig,
      isReady: args.isReady,
      t: args.stableT,
    };
  }

  private static buildUtilRefs(args: IRuntimeBridgeInstallArgs): Record<string, unknown> {
    return {
      ContextBridge,
      PluginUiRegistrar,
      ContextHooks,
      SystemShortcodes,
      AdminComponentRegistry,
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
      MeasurementSystemUtils,
      WidgetViewport,
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
      ThemeMode,
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
      CapabilityRegistry,
      PluginFrontendLayoutRegistrar,
      ThemeFrontendLayoutRegistrar,
      LayoutTargetKind,
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
