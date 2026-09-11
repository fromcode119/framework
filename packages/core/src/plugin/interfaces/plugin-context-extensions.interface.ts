import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';

/**
 * The `context.extensions` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 *
 * It used to carry `build` and `isAvailable` as well — a bridge for a plugin to reach the extension
 * builder it may not import, with core declaring the contract and the api layer registering an
 * implementation so core never depended on the builder that depends on core. All of that machinery
 * had exactly ONE caller: the "build server" plugin, which was never a plugin. It is framework code
 * now (`@fromcode119/sources`) and calls the builder directly, so the bridge is gone.
 */
export interface IPluginContextExtensions {
  installArchive(
    input: { filePath: string; type: ExtensionScope; enable?: boolean; activate?: boolean }
  ): Promise<any>;
}
