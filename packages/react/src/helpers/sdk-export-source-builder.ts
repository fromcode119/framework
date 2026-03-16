export class SdkExportSourceBuilder {
  static readonly SDK_EXPORT_KEYS: readonly string[] = [
    // ── Utility Classes (class-based patterns only) ──
    'CoercionUtils',
    'StringUtils',
    'NumberUtils',
    'FormatUtils',
    'LocalizationUtils',
    'ApiVersionUtils',
    'CollectionUtils',
    'PaginationUtils',
    'HookEventUtils',
    'CollectionQueryUtils',
    'BrowserLocalization',
    'RelationUtils',
    'RuntimeBridge',
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
