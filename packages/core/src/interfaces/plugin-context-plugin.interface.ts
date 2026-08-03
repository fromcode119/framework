/**
 * The `context.plugin` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextPlugin {
  slug: string;
  namespace: string;
  version: string;
  dataDir: string;
  rootDir: string;
  config: Record<string, any>;
}
