import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';

/**
 * The `context.extensions` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextExtensions {
  installArchive(
    input: { filePath: string; type: ExtensionScope; enable?: boolean; activate?: boolean }
  ): Promise<any>;
}
