/**
 * The `context.dependencies` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextDependencies {
  require<TDependency = any>(key: string): TDependency;
  optional<TDependency = any>(key: string): TDependency | null;
}
