export interface ISdkRuntimeExportOffender {
  /** The extension UI file holding the import. */
  file: string;
  /** The SDK names it imports as values that the runtime import map does not publish. */
  names: string[];
}
