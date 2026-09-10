import { RuntimeModuleKind } from '@core/plugin/services/enums/runtime-module-kind.enum';

/**
 * The `context.runtime` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextRuntime {
  registerModule(name: string, config: { keys: string[], type: RuntimeModuleKind }): void;
}
