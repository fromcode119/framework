import { ClientRuntimeConstants } from '@core/constants/client-runtime.constants';

export class RuntimeConstants {
  static readonly GLOBALS = {
    FROMCODE: 'Fromcode',
    MODULES: '__fromcodeRuntimeModules',
    /** Window global carrying server-prefetched page data (nav menus, page-scoped products, …).
     *  The ONLY place this name is defined — framework injectors and theme readers both use it. */
    PAGE_PREFETCH: '__FROMCODE_PAGE_PREFETCH__',
  } as const;

  static readonly CLIENT_TYPES = ClientRuntimeConstants.CLIENT_TYPES;
  static readonly ADMIN_UI = ClientRuntimeConstants.ADMIN_UI;
  static readonly FRONTEND = ClientRuntimeConstants.FRONTEND;

  /**
   * Framework-owned UI slot names. These belong to the FRAMEWORK, not any plugin — kept here so neither
   * the plugin-UI entry template nor a consuming plugin ever inlines a foreign plugin's slug.
   */
  static readonly SLOTS = {
    /** The framework's block-definition registry. Components flagged `static block = true` register their
     *  `definition` here; the block editor (and any block host) reads it. Replaces the legacy, plugin-named
     *  `cms.blocks` slot — the block registry is framework-owned, so its slot carries a framework name. */
    BLOCK_DEFINITIONS: 'fromcode.blocks',
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
    'PublicAssetUrlUtils',
    'UrlUtils',
  ] as const;

  /**
   * Modules always provided by the client-side runtime (hardcoded data: URLs in buildStaticImports).
   * The server must NOT include bridge source for these — it is never used and wastes bandwidth.
   */
  static readonly CLIENT_HANDLED_MODULES = new Set([
    'react',
    'react-dom',
    'react-dom/client',
    'react-jsx',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'lucide-react',
    '@fromcode119/react',
    '@fromcode119/sdk',
    '@fromcode119/sdk/react',
    '@fromcode119/sdk/admin',
    '@fromcode119/admin',
    '@fromcode119/admin/components',
  ]);

  static readonly ADMIN_RUNTIME_EXPORT_KEYS = [
    'MediaPicker', 'Button', 'Input', 'TextArea', 'Select', 'TagField', 'Loader', 'Switch', 'NumberStepper',
    'Card', 'Badge', 'ConfirmDialog', 'PromptDialog', 'DateTimePicker', 'ColorPicker',
    'CodeEditor', 'CurrencySelect', 'MoneyInput', 'VisualMenuField', 'Icon', 'ThemeContext', 'ThemeProvider',
    'NotificationContext', 'PluginPageHeader', 'PluginOverviewCard', 'PluginStatsList',
    'PluginChartCard', 'PluginEmptyState', 'PageHeading', 'StatCard', 'DataTable',
    'AdminServices', 'EditPageSectionNav', 'SectionCard', 'DayRangeToggle',
  ] as const;
}
