import { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';

/**
 * The `context.i18n` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextI18n {
  translate(
    key: string,
    params?: Record<string, any>,
    locale?: string,
    scope?: ExtensionKind | null,
  ): string;
  translateOrFallback(
    key: string,
    fallback: string,
    params?: Record<string, any>,
    locale?: string,
    scope?: ExtensionKind | null,
  ): string;
  t(key: string, params?: Record<string, any>, locale?: string): string;
  registerTranslations(pluginDirectory?: string): void;
  registerTranslations(locale: string, translations: Record<string, any>): void;
}
