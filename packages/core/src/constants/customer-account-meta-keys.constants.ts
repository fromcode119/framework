/**
 * The customer account's system settings — Settings → General → Customer sign-in. Spread into
 * `SystemMetaKeys.ALL`.
 */
export class CustomerAccountMetaKeys {
  static readonly ALL = {
    FRONTEND_AUTH_ENABLED: 'frontend_auth_enabled',
    FRONTEND_REGISTRATION_ENABLED: 'frontend_registration_enabled',
    APP_AUTH_ENABLED: 'app_auth_enabled',
    APP_REGISTRATION_ENABLED: 'app_registration_enabled',
    APP_ANONYMOUS_ENABLED: 'app_anonymous_enabled',
    /** The customer account menu order: section keys (the `/account/<key>` address), comma separated. */
    ACCOUNT_SECTION_ORDER: 'account_section_order',
  } as const;
}
