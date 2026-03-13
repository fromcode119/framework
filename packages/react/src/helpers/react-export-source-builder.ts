export class ReactExportSourceBuilder {
  static readonly SDK_REACT_EXPORT_KEYS: readonly string[] = [
    'FrameworkIcons',
    'FrameworkIconRegistry',
    'PluginsProvider',
    'Slot',
    'Override',
    'RootFramework',
    'CollectionQueryUtils',
    'BrowserLocalization',
  ];

  static buildReactExportSource(bridge: Record<string, unknown>, reactModuleAccessor: string): string {
    const reactBridgeAccessor = `${reactModuleAccessor} || window.Fromcode`;
    return (
      Object.keys(bridge)
        .filter((key) => {
          if (!key || key === 'default' || key === '__esModule') return false;
          if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return false;
          return typeof bridge[key] !== 'undefined';
        })
        .map((key) => `export const ${key} = ${reactModuleAccessor} ? ${reactModuleAccessor}.${key} : window.Fromcode.${key};`)
        .join('\n') +
      ReactExportSourceBuilder.buildGroupedExports(reactModuleAccessor) +
      `export default ${reactBridgeAccessor};`
    );
  }

  static buildSdkReactExportSource(reactModuleAccessor: string): string {
    const reactBridgeAccessor = `${reactModuleAccessor} || window.Fromcode`;
    return (
      ReactExportSourceBuilder.SDK_REACT_EXPORT_KEYS
        .map((key) => `export const ${key} = ${reactModuleAccessor} ? ${reactModuleAccessor}.${key} : window.Fromcode.${key};`)
        .join('\n') +
      ReactExportSourceBuilder.buildGroupedExports(reactModuleAccessor) +
      `export default ${reactBridgeAccessor};`
    );
  }

  private static buildGroupedExports(reactModuleAccessor: string): string {
    const R = reactModuleAccessor;
    const r = (k: string) => `${R} ? ${R}.${k} : window.Fromcode.${k}`;
    return (
      `\nexport const ContextBridge = {\n` +
      `  registerSlotComponent: ${r('registerSlotComponent')},\n` +
      `  registerFieldComponent: ${r('registerFieldComponent')},\n` +
      `  registerOverride: ${r('registerOverride')},\n` +
      `  registerMenuItem: ${r('registerMenuItem')},\n` +
      `  registerCollection: ${r('registerCollection')},\n` +
      `  registerPlugins: ${r('registerPlugins')},\n` +
      `  registerTheme: ${r('registerTheme')},\n` +
      `  registerSettings: ${r('registerSettings')},\n` +
      `  registerAPI: ${r('registerAPI')},\n` +
      `  getAPI: ${r('getAPI')},\n` +
      `  setPluginState: ${r('setPluginState')},\n` +
      `  loadConfig: ${r('loadConfig')},\n` +
      `  getFrontendMetadata: ${r('getFrontendMetadata')},\n` +
      `  emit: ${r('emit')},\n` +
      `  on: ${r('on')},\n` +
      `  t: ${r('t')},\n` +
      `  locale: ${r('locale')},\n` +
      `  setLocale: ${r('setLocale')},\n` +
      `  api: ${r('api')},\n` +
      `};\n` +
      `export const ContextHooks = {\n` +
      `  usePlugins: ${r('usePlugins')},\n` +
      `  useTranslation: ${r('useTranslation')},\n` +
      `  usePluginAPI: ${r('usePluginAPI')},\n` +
      `  usePluginState: ${r('usePluginState')},\n` +
      `};\n` +
      `export const SystemShortcodes = {\n` +
      `  useSystemShortcodes: ${r('useSystemShortcodes')},\n` +
      `};\n`
    );
  }
}
