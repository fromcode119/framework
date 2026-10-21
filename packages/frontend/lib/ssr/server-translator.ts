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
   * Dotted key paths this render read — through `t` or straight off `translations`. The document
   * inlines only these, so the browser hydrates against exactly the copy the server painted without
   * carrying every active plugin's dictionary; the provider loads the full set after hydration.
   * A path names a whole subtree when the render enumerated an object instead of reading one key.
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
    this.tracked = this.track(this.dictionary, '');
  }

  /** The merged dictionary, published on the context as `translations`. */
  get effective(): Record<string, unknown> {
    return this.tracked;
  }

  /** The key paths read so far, sorted. */
  get paths(): string[] {
    return [...this.read].sort();
  }

  @bound translate(key: string, params: Record<string, unknown> = {}, defaultValue?: string): string {
    this.read.add(String(key || ''));
    return FrontendI18nService.translate(this.dictionary, key, params, defaultValue);
  }

  /**
   * A read-through view of `node` that records every leaf it hands out, and the whole node when it
   * is enumerated (spread, `Object.keys`, `for…in`) — the render then depends on all of it.
   */
  private track(node: Record<string, unknown>, path: string): Record<string, unknown> {
    const read = this.read;
    const child = (key: string) => (path ? `${path}.${key}` : key);
    const nested = new Map<string, Record<string, unknown>>();
    const translator = this;
    return new Proxy(node, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof property !== 'string') return value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (!nested.has(property)) nested.set(property, translator.track(value as Record<string, unknown>, child(property)));
          return nested.get(property);
        }
        read.add(child(property));
        return value;
      },
      ownKeys(target) {
        if (path) read.add(path);
        else Object.keys(target).forEach((key) => read.add(key));
        return Reflect.ownKeys(target);
      },
    });
  }
}
