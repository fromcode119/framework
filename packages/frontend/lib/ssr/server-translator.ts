import { bound } from '@fromcode119/reactor';
import { FrontendI18nService } from '@fromcode119/react/context/frontend-i18n-service';

/**
 * The `t` the server hands a theme while pre-rendering it — the non-hook twin of the `t` the browser
 * provider publishes. Same resolution order (server dictionary → locale-agnostic registrations →
 * active-locale registrations) and the same key lookup, both from `FrontendI18nService`, so the copy
 * painted server-side is the copy the theme renders after hydration.
 */
export class ServerTranslator {
  private readonly dictionary: Record<string, unknown>;

  constructor(
    serverTranslations: Record<string, unknown>,
    registeredByLocale: Record<string, Record<string, unknown>>,
    locale: string,
  ) {
    this.dictionary = FrontendI18nService.resolveEffective(serverTranslations, registeredByLocale, locale);
  }

  /** The merged dictionary, published on the context as `translations`. */
  get effective(): Record<string, unknown> {
    return this.dictionary;
  }

  @bound translate(key: string, params: Record<string, unknown> = {}, defaultValue?: string): string {
    return FrontendI18nService.translate(this.dictionary, key, params, defaultValue);
  }
}
