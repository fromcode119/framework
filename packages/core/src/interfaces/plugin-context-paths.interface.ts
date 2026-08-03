import type { IPluginPathReadOptions } from '@core/interfaces/plugin-path-read-options.interface';

/**
 * The `context.paths` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextPaths {
  frameworkRoot: string;
  pluginsRoot: string;
  themesRoot: string;
  currentPluginRoot: string;
  resolveCurrentPluginRoot(): string;
  resolveActiveThemeSlug(): Promise<string | null>;
  resolveActiveThemeRoot(): Promise<string | null>;
  readCurrentPluginText(relativePath: string, options?: IPluginPathReadOptions): Promise<string>;
  readCurrentPluginJson(relativePath: string, options?: IPluginPathReadOptions): Promise<Record<string, any>>;
  readCurrentPluginTemplate(relativePath: string): Promise<string>;
}
