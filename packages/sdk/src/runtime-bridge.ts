export const RUNTIME_GLOBALS = {
  FROMCODE: 'Fromcode',
  MODULES: '__fromcodeRuntimeModules'
} as const;

export const RUNTIME_MODULE_NAMES = {
  ADMIN: '@fromcode119/admin',
  ADMIN_COMPONENTS: '@fromcode119/admin/components'
} as const;

export const ADMIN_RUNTIME_EXPORT_KEYS = [
  'MediaPicker',
  'Button',
  'Input',
  'TextArea',
  'Select',
  'TagField',
  'Loader',
  'Switch',
  'Card',
  'Badge',
  'ConfirmDialog',
  'PromptDialog',
  'DateTimePicker',
  'ColorPicker',
  'CodeEditor',
  'VisualMenuField',
  'Icon',
  'ThemeContext',
  'ThemeProvider',
  'NotificationContext',
  'PluginPageHeader',
  'PluginOverviewCard',
  'PluginStatsList',
  'PluginChartCard',
  'PluginEmptyState',
  'PageHeading',
  'StatCard',
  'DataTable'
] as const;

/**
 * Resolves the framework's internal bridge for a specific runtime module.
 * This is used by plugins to communicate with the shared singleton state
 * managed by the framework core.
 */
export function getFrameworkRuntimeBridge<T = any>(moduleName: string = '@fromcode119/react'): T {
  if (typeof window === 'undefined') return {} as T;
  
  const win = window as any;
  const modules = win[RUNTIME_GLOBALS.MODULES];
  
  // 1. Try modern centralized registry
  // 2. Fallback to legacy global object
  // 3. Last resort is an empty object
  return (modules?.[moduleName]) || win[RUNTIME_GLOBALS.FROMCODE] || {};
}
