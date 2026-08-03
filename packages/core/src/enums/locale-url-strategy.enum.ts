import { Enum } from '@fromcode119/reactor';

/** How the active locale is encoded in URLs. Read from the `locale_url_strategy` setting string. */
export class LocaleUrlStrategy extends Enum {
  static readonly QUERY = new LocaleUrlStrategy('query');
  static readonly PATH = new LocaleUrlStrategy('path');
  static readonly NONE = new LocaleUrlStrategy('none');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a setting string to a member; defaults to QUERY. */
  static resolve(value: unknown): LocaleUrlStrategy {
    if (value instanceof LocaleUrlStrategy) return value;
    const found = LocaleUrlStrategy.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as LocaleUrlStrategy | undefined) ?? LocaleUrlStrategy.QUERY;
  }
}
