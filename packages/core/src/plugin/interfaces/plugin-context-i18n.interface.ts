import { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';
import type { ISiteClock } from '@core/i18n/interfaces/site-clock.interface';

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
  /** The platform's configured default locale (admin Settings → Localization `default_locale`). */
  defaultLocale(): string;
  /**
   * The current site's clock — timezone and 12/24-hour cycle — for writing a time a person will read
   * (an email, a document). Pass both to `toLocaleString` / `Intl.DateTimeFormat`.
   */
  siteClock(): Promise<ISiteClock>;
  registerTranslations(pluginDirectory?: string): void;
  registerTranslations(locale: string, translations: Record<string, any>): void;
}
