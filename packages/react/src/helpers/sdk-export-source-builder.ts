export class SdkExportSourceBuilder {
  static readonly SDK_EXPORT_KEYS: readonly string[] = [
    'BaseRepository',
    'BaseService',
    'BaseController',
    'CoercionUtils',
    'StringUtils',
    'NumberUtils',
    'MeasurementSystemUtils',
    'WidgetViewport',
    'FormatUtils',
    'ApiRequestError',
    'ApiRequestService',
    'ApiQueryUtils',
    'ApiPathUtils',
    'AdminUserClient',
    'ApiScopeClient',
    'CollectionScopeClient',
    'SettingsScopeClient',
    'SdkClient',
    'AdminGlobalClient',
    'AdminResourceClient',
    'AdminSdkClient',
    'BrowserStateClient',
    'BrowserStateRuntimeBuilder',
    'SystemAuthClient',
    'SystemAuthSession',
    // Storefront blocks need light/dark. This list is hand-maintained and IS the frontend's import map
    // for `@fromcode119/sdk` — a plugin frontend bundle importing a name that is missing here fails to
    // load with "does not provide an export named …", and the page body renders empty.
    'ThemeMode',
    // Plugins declare their own enums as `class X extends Enum`. Without this the bundle fails to load
    // entirely with "does not provide an export named 'Enum'" — the same failure mode as any other
    // missing key here, and it takes the whole plugin down, not just the enum.
    'Enum',
    'Plugins',
    'PluginsFacade',
    'NamespacedPluginsFacade',
    'PluginsRegistry',
    'LocalizationUtils',
    'CollectionUtils',
    'PaginationUtils',
    'HookEventUtils',
    'RelationUtils',
    'ShortcodeUtils',
    'PluginDefinitionUtils',
    'RouteUtils',
    'UrlUtils',
    'ApplicationUrlUtils',
    'RuntimeLocationUtils',
    'PublicAssetUrlUtils',
    'ApiVersionUtils',
    'RuntimeBridge',
    'CoreServices',
    'MediaRelationService',
    'SystemConstants',
    'ClientRuntimeConstants',
    'CookieConstants',
    'RuntimeConstants',
    'RouteConstants',
    'AccountRouteUtils',
    'PublicRouteConstants',
    'DataSourceConstants',
    'Logger',
    'LogLevel',
    'CapabilityRegistry',
    'PluginFrontendLayoutRegistrar',
    'ThemeFrontendLayoutRegistrar',
    'ThemeOverrideRegistrar',
    'RecordVersions',
    'PluginCapability',
    'MiddlewareStage',
    'InteractiveCanvas',
    'LiveBlocks',
    'LocalizedField',
    'PublicSettings',
  ];

  static build(reactModuleAccessor: string): string {
    const scopedReactModuleAccessor = `(${reactModuleAccessor})`;
    return (
      SdkExportSourceBuilder.SDK_EXPORT_KEYS
        // The registry is populated during the pre-boot stub phase, so the accessor resolves before
        // any bundle imports this module; the null-safe ternary only guards a pathological early eval.
        .map((key) => `export const ${key} = ${scopedReactModuleAccessor} ? ${scopedReactModuleAccessor}.${key} : undefined;`)
        .join('\n') +
      `\nexport default ${scopedReactModuleAccessor};`
    );
  }
}
