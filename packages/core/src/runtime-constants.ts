export class RuntimeConstants {
  static readonly GLOBALS = {
    FROMCODE: 'Fromcode',
    MODULES: '__fromcodeRuntimeModules',
  } as const;

  static readonly MODULE_NAMES = {
    ADMIN: '@fromcode119/admin',
    ADMIN_COMPONENTS: '@fromcode119/admin/components',
  } as const;

  /**
   * All SDK utility class names that must always be available in the plugin sandbox.
   * Plugin code should use these classes (e.g. CoercionUtils.toNumber) instead of
   * deprecated bare function aliases (e.g. coerceNumber).
   */
  static readonly SDK_UTIL_CLASS_NAMES = [
    'CoercionUtils',
    'StringUtils',
    'NumberUtils',
    'FormatUtils',
    'LocalizationUtils',
    'PaginationUtils',
    'CollectionUtils',
    'HookEventUtils',
    'ApiVersionUtils',
    'RouteUtils',
    'UrlUtils',
  ] as const;

  static readonly ADMIN_RUNTIME_EXPORT_KEYS = [
    'MediaPicker', 'Button', 'Input', 'TextArea', 'Select', 'TagField', 'Loader', 'Switch',
    'Card', 'Badge', 'ConfirmDialog', 'PromptDialog', 'DateTimePicker', 'ColorPicker',
    'CodeEditor', 'VisualMenuField', 'Icon', 'ThemeContext', 'ThemeProvider',
    'NotificationContext', 'PluginPageHeader', 'PluginOverviewCard', 'PluginStatsList',
    'PluginChartCard', 'PluginEmptyState', 'PageHeading', 'StatCard', 'DataTable',
    'AdminServices', 'EditPageSectionNav',
  ] as const;
}

