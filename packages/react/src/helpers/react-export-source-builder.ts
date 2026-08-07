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
    'PluginUiRegistrar',
  ]);

  static readonly SDK_REACT_EXPORT_KEYS: readonly string[] = [
    'FrameworkIcons',
    'FrameworkIconRegistry',
    'PluginsProvider',
    'Slot',
    'Override',
    'AccountShell',
    'SlotsContext',
    'Platform',
    'AccountShellDefault',
    'AccountSectionRegistry',
    'AccountSection',
    'AccountSectionIcons',
    'AccountShellSkeleton',
    'AccountShellPlaceholder',
    'AccountClass',
    'AuthMode',
    'AuthShell',
    'RecordsHub',
    'RootFramework',
    'CollectionQueryUtils',
    'BrowserLocalization',
    'AdminComponentRegistry',
    'AsyncDataController',
    'LazyComponentLoaderService',
    'LazyLoadClass',
    'PageStyleContext',
    'PageStyleProvider',
    'PageStyleHooks',
    'PluginRuntimeContext',
    'PluginRuntimeProvider',
    'PluginComponent',
    'Reactor',
    'PureReactor',
    'Provider',
    'Bridge',
    'Enum',
    // React's own values (Fragment/Suspense/lazy/createElement/…) surfaced from reactor so plugin and
    // theme bundles never import 'react' directly. A missing name here fails the bundle at LOAD.
    'ReactPrimitives',
    'Context',
    'prop',
    'state',
    'bound',
    'watch',
    'ref',
  ];

  private static readonly REQUIRED_REACT_EXPORT_KEYS: readonly string[] = [
    'LazyComponentLoaderService',
    'LazyLoadClass',
  ];

  static buildReactExportSource(bridge: Record<string, unknown>, reactModuleAccessor: string): string {
    const scopedReactModuleAccessor = `(${reactModuleAccessor})`;
    return (
      Object.keys(bridge)
        .filter((key) => {
          if (!key || key === 'default' || key === '__esModule') return false;
          if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return false;
          if (ReactExportSourceBuilder.BANNED_STANDALONE_EXPORTS.has(key)) return false;
          return typeof bridge[key] !== 'undefined';
        })
        // The registry is populated during the pre-boot stub phase, so the accessor resolves before
        // any bundle imports this module; the null-safe ternary only guards a pathological early eval.
        .map((key) => `export const ${key} = ${scopedReactModuleAccessor} ? ${scopedReactModuleAccessor}.${key} : undefined;`)
        .join('\n') +
      ReactExportSourceBuilder.buildRequiredExports(scopedReactModuleAccessor) +
      ReactExportSourceBuilder.buildGroupedExports(scopedReactModuleAccessor) +
      `export default ${scopedReactModuleAccessor};`
    );
  }

  static buildSdkReactExportSource(reactModuleAccessor: string): string {
    const scopedReactModuleAccessor = `(${reactModuleAccessor})`;
    return (
      ReactExportSourceBuilder.SDK_REACT_EXPORT_KEYS
        // The registry is populated during the pre-boot stub phase, so the accessor resolves before
        // any bundle imports this module; the null-safe ternary only guards a pathological early eval.
        .map((key) => `export const ${key} = ${scopedReactModuleAccessor} ? ${scopedReactModuleAccessor}.${key} : undefined;`)
        .join('\n') +
      ReactExportSourceBuilder.buildGroupedExports(scopedReactModuleAccessor) +
      `export default ${scopedReactModuleAccessor};`
    );
  }

  private static buildGroupedExports(reactModuleAccessor: string): string {
    const R = reactModuleAccessor;
    // Export the ACTUAL class objects stored on the bridge — not proxy plain-objects.
    // ContextBridge / ContextHooks / SystemShortcodes are real ES classes with static
    // methods that call getBridge() at invocation time, so there are no timing races.
    // The registry is populated during the pre-boot stub phase, so the accessor resolves before any
    // bundle imports this module; the null-safe ternary only guards a pathological early eval.
    return (
      `\nexport const ContextBridge = ${R} ? ${R}.ContextBridge : undefined;\n` +
      `export const ContextHooks = ${R} ? ${R}.ContextHooks : undefined;\n` +
      `export const SystemShortcodes = ${R} ? ${R}.SystemShortcodes : undefined;\n` +
      `export const PluginUiRegistrar = ${R} ? ${R}.PluginUiRegistrar : undefined;\n`
    );
  }

  private static buildRequiredExports(reactModuleAccessor: string): string {
    return ReactExportSourceBuilder.REQUIRED_REACT_EXPORT_KEYS
      .map((key) => `\nexport const ${key} = (${reactModuleAccessor} ? ${reactModuleAccessor}.${key} : undefined);`)
      .join('');
  }
}
