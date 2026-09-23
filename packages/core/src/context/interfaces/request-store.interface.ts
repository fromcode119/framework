export interface IRequestStore {
  /**
   * The locale this work is being done in.
   *
   * Optional because a SCHEDULED run genuinely has none — there is no request and no visitor to
   * have a preference. Both readers already fall back to the configured locale, which is where a
   * default belongs; filling this with an invented "en" would put one in code instead.
   */
  locale?: string;
  /**
   * The tenant this request belongs to.
   *
   * Absent means NO tenant — never "all tenants" and never a default. Resolved once per request
   * from the Host header; see ServerMiddlewareSetup.
   */
  tenantId?: string;
  /**
   * The bound SITE's own default locale (Settings → Localization), when it has one. What
   * `context.i18n.defaultLocale()` answers for work done on a site's behalf; absent in the platform scope
   * and for a site that set none, where the platform's applies.
   */
  siteLocale?: string;
  [key: string]: any;
}
