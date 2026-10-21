import { bound } from '@fromcode119/react-class-components';
import { FrontendI18nService } from '@fromcode119/react/context/frontend-i18n-service';

/**
 * The `t` the server hands a theme while pre-rendering it — the non-hook twin of the `t` the browser
 * provider publishes. Same layer order (server dictionary → plugin registrations → theme
 * registrations) and the same key lookup, both from `FrontendI18nService`, so the copy painted
 * server-side is the copy the theme renders after hydration.
 */
export class ServerTranslator {
  private readonly dictionary: Record<string, unknown>;

  /**
   * Top-level namespaces this render read — through `t` or straight off `translations`. The document
   * inlines only these, so the browser hydrates against exactly the copy the server painted without
   * carrying every active plugin's dictionary; the provider loads the full set after hydration.
   */
  private readonly read = new Set<string>();

  private readonly tracked: Record<string, unknown>;

  constructor(
    serverTranslations: Record<string, unknown>,
    registeredByLocale: Record<string, Record<string, unknown>>,
    locale: string,
    themeByLocale: Record<string, Record<string, unknown>> = {},
  ) {
    this.dictionary = FrontendI18nService.resolveEffective(
      serverTranslations,
      registeredByLocale,
      locale,
      themeByLocale,
    );
    const read = this.read;
    this.tracked = new Proxy(this.dictionary, {
      get(target, property, receiver) {
        if (typeof property === 'string') read.add(property);
        return Reflect.get(target, property, receiver);
      },
    });
  }

  /** The merged dictionary, published on the context as `translations`. */
  get effective(): Record<string, unknown> {
    return this.tracked;
  }

  /** The namespaces read so far, sorted. */
  get namespaces(): string[] {
    return [...this.read].sort();
  }

  @bound translate(key: string, params: Record<string, unknown> = {}, defaultValue?: string): string {
    this.read.add(String(key || '').split('.')[0]);
    return FrontendI18nService.translate(this.dictionary, key, params, defaultValue);
  }
}
