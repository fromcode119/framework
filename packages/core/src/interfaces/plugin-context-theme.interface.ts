/**
 * The `context.theme` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextTheme {
  getActiveSlug(): Promise<string | null>;
  getActiveConfig(): Promise<Record<string, any>>;
  getCurrentPluginSettings(): Promise<Record<string, any>>;
}
