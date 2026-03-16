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
        // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet set
        // when this data URL module is evaluated (e.g. timing race during bundle load).
        .map((key) => `export const ${key} = ${reactModuleAccessor} ? ${reactModuleAccessor}.${key} : (window.Fromcode && window.Fromcode.${key});`)
        .join('\n') +
      ReactExportSourceBuilder.buildGroupedExports(reactModuleAccessor) +
      `export default ${reactBridgeAccessor};`
    );
  }

  static buildSdkReactExportSource(reactModuleAccessor: string): string {
    const reactBridgeAccessor = `${reactModuleAccessor} || window.Fromcode`;
    return (
      ReactExportSourceBuilder.SDK_REACT_EXPORT_KEYS
        // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet set
        // when this data URL module is evaluated (e.g. timing race during bundle load).
        .map((key) => `export const ${key} = ${reactModuleAccessor} ? ${reactModuleAccessor}.${key} : (window.Fromcode && window.Fromcode.${key});`)
        .join('\n') +
      ReactExportSourceBuilder.buildGroupedExports(reactModuleAccessor) +
      `export default ${reactBridgeAccessor};`
    );
  }

  private static buildGroupedExports(reactModuleAccessor: string): string {
    const R = reactModuleAccessor;
    // Use lazy getters so values are resolved at call time, not at module evaluation time.
    // This avoids timing races where the data URL module evaluates before the runtime bridge is installed.
    // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet initialised.
    const g = (k: string) => `get ${k}() { const _r = ${R}; return _r ? _r.${k} : (window.Fromcode && window.Fromcode.${k}); }`;
    return (
      `\nexport const ContextBridge = {\n` +
      `  ${g('registerSlotComponent')},\n` +
      `  ${g('registerFieldComponent')},\n` +
      `  ${g('registerOverride')},\n` +
      `  ${g('registerMenuItem')},\n` +
      `  ${g('registerCollection')},\n` +
      `  ${g('registerPlugins')},\n` +
      `  ${g('registerTheme')},\n` +
      `  ${g('registerSettings')},\n` +
      `  ${g('registerAPI')},\n` +
      `  ${g('getAPI')},\n` +
      `  ${g('setPluginState')},\n` +
      `  ${g('loadConfig')},\n` +
      `  ${g('getFrontendMetadata')},\n` +
      `  ${g('emit')},\n` +
      `  ${g('on')},\n` +
      `  ${g('t')},\n` +
      `  ${g('locale')},\n` +
      `  ${g('setLocale')},\n` +
      `  ${g('api')},\n` +
      `};\n` +
      `export const ContextHooks = {\n` +
      `  ${g('usePlugins')},\n` +
      `  ${g('useTranslation')},\n` +
      `  ${g('usePluginAPI')},\n` +
      `  ${g('usePluginState')},\n` +
      `};\n` +
      `export const SystemShortcodes = {\n` +
      `  ${g('useSystemShortcodes')},\n` +
      `};\n`
    );
  }
}
