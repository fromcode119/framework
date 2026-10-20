/**
 * Settings → Localization: languages, the measurement system and the site's country. Part of
 * `SystemConstants.META_KEY` — spread into `SystemMetaKeys.ALL` — and split out because the storefront
 * runtime needs these few keys, and importing the whole catalog put every system setting key in the
 * browser bundle.
 */
export class LocalizationMetaKeys {
  static readonly ALL = {
    LOCALIZATION_LOCALES: 'localization_locales',
    ENABLED_LOCALES: 'enabled_locales',
    DEFAULT_LOCALE: 'default_locale',
    FALLBACK_LOCALE: 'fallback_locale',
    ADMIN_DEFAULT_LOCALE: 'admin_default_locale',
    FRONTEND_DEFAULT_LOCALE: 'frontend_default_locale',
    LOCALE_URL_STRATEGY: 'locale_url_strategy',
    // Platform-wide measurement system (metric cm/kg | imperial in/lb). A regional format like locale —
    // domain plugins read it for their own units; the framework stays domain-agnostic.
    MEASUREMENT_SYSTEM: 'measurement_system',
    // The country this site operates in (ISO 3166-1 alpha-2). ONE setting every country-aware module
    // inherits — invoicing law, tax withholding, payroll — each may override it for itself. Blank means
    // "derive it from the frontend language" (`PlatformCountryUtils`), and the admin says which country
    // that produced.
    COUNTRY: 'country',
  } as const;
}
