export class ReactExportSourceBuilder {
  /**
   * Keys that must NOT be exported as standalone named exports from @fromcode119/react.
   *
   * These three keys are present on the bridge (via buildUtilRefs) AND are also exported
   * as actual class references via buildGroupedExports(). Banning them here prevents
   * duplicate export declarations from the standalone Object.keys(bridge) loop.
   */
  private static readonly BANNED_STANDALONE_EXPORTS: ReadonlySet<string> = new Set([
    // Exported as actual class references via buildGroupedExports() — ban here to prevent
    // duplicate export declarations from the standalone Object.keys(bridge) loop.
    'ContextBridge',
    'ContextHooks',
    'SystemShortcodes',
  ]);

  static readonly SDK_REACT_EXPORT_KEYS: readonly string[] = [
    'FrameworkIcons',
    'FrameworkIconRegistry',
    'PluginsProvider',
    'Slot',
    'Override',
    'RootFramework',
    'CollectionQueryUtils',
    'BrowserLocalization',
    'AsyncDataController',
  ];

  static buildReactExportSource(bridge: Record<string, unknown>, reactModuleAccessor: string): string {
    const scopedReactModuleAccessor = `(${reactModuleAccessor})`;
    const reactBridgeAccessor = `${scopedReactModuleAccessor} || window.Fromcode`;
    return (
      Object.keys(bridge)
        .filter((key) => {
          if (!key || key === 'default' || key === '__esModule') return false;
          if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return false;
          if (ReactExportSourceBuilder.BANNED_STANDALONE_EXPORTS.has(key)) return false;
          return typeof bridge[key] !== 'undefined';
        })
        // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet set
        // when this data URL module is evaluated (e.g. timing race during bundle load).
        .map((key) => `export const ${key} = ${scopedReactModuleAccessor} ? ${scopedReactModuleAccessor}.${key} : (window.Fromcode && window.Fromcode.${key});`)
        .join('\n') +
      ReactExportSourceBuilder.buildGroupedExports(scopedReactModuleAccessor) +
      `export default ${reactBridgeAccessor};`
    );
  }

  static buildSdkReactExportSource(reactModuleAccessor: string): string {
    const scopedReactModuleAccessor = `(${reactModuleAccessor})`;
    const reactBridgeAccessor = `${scopedReactModuleAccessor} || window.Fromcode`;
    return (
      ReactExportSourceBuilder.SDK_REACT_EXPORT_KEYS
        // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet set
        // when this data URL module is evaluated (e.g. timing race during bundle load).
        .map((key) => `export const ${key} = ${scopedReactModuleAccessor} ? ${scopedReactModuleAccessor}.${key} : (window.Fromcode && window.Fromcode.${key});`)
        .join('\n') +
      ReactExportSourceBuilder.buildGroupedExports(scopedReactModuleAccessor) +
      `export default ${reactBridgeAccessor};`
    );
  }

  private static buildGroupedExports(reactModuleAccessor: string): string {
    const R = reactModuleAccessor;
    // Export the ACTUAL class objects stored on the bridge — not proxy plain-objects.
    // ContextBridge / ContextHooks / SystemShortcodes are real ES classes with static
    // methods that call getBridge() at invocation time, so there are no timing races.
    // Null-safe Fromcode fallback prevents TypeError if window.Fromcode is not yet set
    // when this data URL module is evaluated (e.g. during early bundle load).
    return (
      `\nexport const ContextBridge = ${R} ? ${R}.ContextBridge : (window.Fromcode && window.Fromcode.ContextBridge);\n` +
      `export const ContextHooks = ${R} ? ${R}.ContextHooks : (window.Fromcode && window.Fromcode.ContextHooks);\n` +
      `export const SystemShortcodes = ${R} ? ${R}.SystemShortcodes : (window.Fromcode && window.Fromcode.SystemShortcodes);\n`
    );
  }
}
