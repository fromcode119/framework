import type { IPluginSettingsSchema } from '@core/interfaces/plugin-settings-schema.interface';

/**
 * The `context.settings` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextSettings {
  register(schema: IPluginSettingsSchema): void;
  get(): Promise<Record<string, any>>;
  update(values: Record<string, any>): Promise<void>;
}
