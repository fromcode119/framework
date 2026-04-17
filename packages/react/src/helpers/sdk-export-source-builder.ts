export class SdkExportSourceBuilder {
  static readonly SDK_EXPORT_KEYS: readonly string[] = [
    'BaseRepository',
    'BaseService',
    'BaseController',
    'CoercionUtils',
    'StringUtils',
    'NumberUtils',
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
    'PublicRouteConstants',
    'DataSourceConstants',
    'Logger',
    'LogLevel',
    'EnvConfig',
    'CapabilityRegistry',
    'IntegrationRegistry',
    'RecordVersions',
    'PluginCapability',
    'MiddlewareStage',
  ];

  static build(reactModuleAccessor: string): string {
    const scopedReactModuleAccessor = `(${reactModuleAccessor})`;
    const reactBridgeAccessor = `${scopedReactModuleAccessor} || window.Fromcode`;
    return (
      SdkExportSourceBuilder.SDK_EXPORT_KEYS
        // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet set
        // when this data URL module is evaluated (e.g. timing race during bundle load).
        .map((key) => `export const ${key} = ${scopedReactModuleAccessor} ? ${scopedReactModuleAccessor}.${key} : (window.Fromcode && window.Fromcode.${key});`)
        .join('\n') +
      `\nexport default ${reactBridgeAccessor};`
    );
  }
}
