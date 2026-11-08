import { LocalizationUtils, type I18nManager } from '@fromcode119/core';

/**
 * The serialized `/system/i18n` body, built once per locale and set of plugins.
 *
 * The bundle is ~250 KB, and the storefront asks for it on every page render: serializing it again
 * each time cost ~40 ms of the api's one thread per page, which every other request then waited
 * behind. The body only changes when a translation is registered (`I18nManager.revision`), so it is
 * kept until then and rebuilt on the next request after.
 */
export class I18nResponseBody {
  private static readonly MAX_ENTRIES = 64;
  private static revision = -1;
  private static readonly bodies = new Map<string, string>();

  static for(i18n: I18nManager, locale: string, activeSlugs: Set<string>): string {
    const revision = i18n.revision();
    if (revision !== I18nResponseBody.revision) {
      I18nResponseBody.bodies.clear();
      I18nResponseBody.revision = revision;
    }
    const key = `${locale}|${[...activeSlugs].sort().join(',')}`;
    const cached = I18nResponseBody.bodies.get(key);
    if (cached !== undefined) return cached;

    const translations = I18nResponseBody.dictionary(i18n, locale);
    const filtered: Record<string, unknown> = {};
    for (const [slug, data] of Object.entries(translations)) {
      if (activeSlugs.has(slug)) filtered[slug] = data;
    }
    const body = JSON.stringify(filtered);
    if (I18nResponseBody.bodies.size >= I18nResponseBody.MAX_ENTRIES) I18nResponseBody.bodies.clear();
    I18nResponseBody.bodies.set(key, body);
    return body;
  }

  /**
   * The dictionary a tag reads: its own, else the one its language is filed under. Files are named by
   * language (`de.json`, `zh-hant.json`) while a browser or a console asks for `de-AT` or `zh-TW`, and
   * an exact match alone handed those readers English.
   */
  private static dictionary(i18n: I18nManager, locale: string): Record<string, unknown> {
    const exact = i18n.translations.get(locale);
    if (exact) return exact;
    const key = LocalizationUtils.normalizeLocaleCode(locale, { short: true });
    if (!key) return {};
    return i18n.translations.get(key) || i18n.translations.get(key.split('-')[0]) || {};
  }
}
