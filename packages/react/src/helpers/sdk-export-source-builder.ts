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
    'PublicAssetUrlUtils',
    'ApiVersionUtils',
    'RuntimeBridge',
    'CoreServices',
    'SystemConstants',
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
    const reactBridgeAccessor = `${reactModuleAccessor} || window.Fromcode`;
    return (
      SdkExportSourceBuilder.SDK_EXPORT_KEYS
        // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet set
        // when this data URL module is evaluated (e.g. timing race during bundle load).
        .map((key) => `export const ${key} = ${reactModuleAccessor} ? ${reactModuleAccessor}.${key} : (window.Fromcode && window.Fromcode.${key});`)
        .join('\n') +
      `\nexport default ${reactBridgeAccessor};`
    );
  }
}
