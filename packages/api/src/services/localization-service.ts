import { ApiResponseCache, ICollection, RequestContextUtils, SiteContentRevision, SystemConstants, SystemSettingsExposureUtils } from '@fromcode119/core';
import { CoreServices } from '@fromcode119/core';
import { LocalizationUtils } from '@fromcode119/core';

export class LocalizationService {
  constructor(private db: any) {}

  public parseLocaleMap(value: any): Record<string, any> | null {
    let candidate = value;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
      try {
        candidate = JSON.parse(trimmed);
      } catch {
        return null;
      }
    }

    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

    const entries = Object.entries(candidate);
    if (!entries.length) return null;
    if (!entries.every(([key]) => Boolean(LocalizationUtils.normalizeLocaleCode(key)))) return null;

    const normalized: Record<string, any> = {};
    entries.forEach(([rawKey, rawValue]) => {
      const locale = LocalizationUtils.normalizeLocaleCode(rawKey);
      if (locale) normalized[locale] = rawValue;
    });

    return Object.keys(normalized).length ? normalized : null;
  }

  public isJsonStorageField(type: string): boolean {
    return ['json', 'relationship', 'upload', 'richText'].includes(type);
  }

  /**
   * A localized field with scalar storage (text/textarea/…) may only hold primitives in its locale
   * slots. An object that is not a locale map (e.g. `{}` from a stale admin form) written into a slot
   * produces `{"bg":{}}` junk — the write half of the wiped-shortDescription bug. JSON-storage fields
   * (contentBlocks etc.) legitimately store objects in slots and are never junk here.
   */
  public isJunkForLocaleSlot(field: any, value: any): boolean {
    if (this.isJsonStorageField(String(field?.type || ''))) return false;
    return Boolean(value) && typeof value === 'object';
  }

  public serializeLocaleMap(field: any, map: Record<string, any>): any {
    if (this.isJsonStorageField(String(field?.type || ''))) {
      return map;
    }
    return JSON.stringify(map);
  }

  /**
   * The five locale settings, for the site in scope. Every request read the WHOLE settings table for
   * them — on a plain collection list, the one statement besides the read itself. Kept per site under
   * its content revision (SiteContentRevision), which a settings save moves in every api process, so
   * the next request after a save reads them afresh — and never longer than the operator's API response
   * cache age (0 keeps nothing), the backstop for a write that did not move the revision.
   */
  private async localeSettings(): Promise<Record<string, any>> {
    const tenantId = String(RequestContextUtils.getTenantId() ?? '');
    const revision = SiteContentRevision.current(tenantId || null);
    const maxAgeMs = ApiResponseCache.maxAgeSeconds() * 1000;
    const kept = this.keptLocaleSettings.get(tenantId);
    if (kept?.revision === revision && Date.now() - kept.at < maxAgeMs) return kept.map;
    const settingsMap: Record<string, any> = {};
    try {
      const settingsRows = await this.db.find(SystemConstants.TABLE.META, { where: { key: { in: LocalizationService.LOCALE_KEYS } } });
      if (Array.isArray(settingsRows)) {
        SystemSettingsExposureUtils.withPrecedence(settingsRows).forEach((row: any) => {
          if (row.key) settingsMap[row.key] = row.value;
        });
      }
    } catch {
      // Fall back to defaults if metadata fetch fails — and keep nothing, so the next request asks again.
      return settingsMap;
    }
    if (this.keptLocaleSettings.size > 1000) this.keptLocaleSettings.clear();
    if (maxAgeMs > 0) this.keptLocaleSettings.set(tenantId, { revision, at: Date.now(), map: settingsMap });
    return settingsMap;
  }

  private static readonly LOCALE_KEYS = [
    SystemConstants.META_KEY.DEFAULT_LOCALE, SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE, SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE,
    SystemConstants.META_KEY.FALLBACK_LOCALE, SystemConstants.META_KEY.ENABLED_LOCALES,
  ];

  private readonly keptLocaleSettings = new Map<string, { revision: string; at: number; map: Record<string, any> }>();

  public async getLocaleContext(req: any): Promise<{
    locale: string;
    defaultLocale: string;
    fallbackLocale: string;
    chain: string[];
  }> {
    if (req?._fcLocaleContext) return req._fcLocaleContext;

    const settingsMap = await this.localeSettings();

    const requestedLocale = LocalizationUtils.normalizeLocaleCode(
      req?.query?.locale || req?.locale || req?.headers?.['x-locale'] || ''
    );

    const defaultLocale = LocalizationUtils.normalizeLocaleCode(
      settingsMap.default_locale ||
      settingsMap.frontend_default_locale ||
      settingsMap.admin_default_locale ||
      'en'
    ) || 'en';

    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(
      req?.query?.fallback_locale ||
      settingsMap.fallback_locale ||
      defaultLocale
    ) || defaultLocale;

    const enabledLocales = String(settingsMap.enabled_locales || '')
      .split(',')
      .map((value) => LocalizationUtils.normalizeLocaleCode(value))
      .filter(Boolean);

    const chain = Array.from(new Set([requestedLocale, defaultLocale, fallbackLocale, ...enabledLocales].filter(Boolean)));
    const context = {
      locale: requestedLocale || defaultLocale,
      defaultLocale,
      fallbackLocale,
      chain: chain.length ? chain : [defaultLocale]
    };

    if (req) req._fcLocaleContext = context;
    return context;
  }

  public transformOutgoingData(
    collection: ICollection,
    data: any,
    options: {
      localeContext: { chain: string[]; defaultLocale: string };
      rawLocalized: boolean;
    }
  ) {
    if (!data) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.transformOutgoingData(collection, item, options));
    }

    const cleanData = { ...data };
    collection.fields.forEach((field: any) => {
      // NOTE: `admin.hidden` is an ADMIN-FORM presentation flag ("don't render this input"), NOT a
      // serialization or access rule. This used to `delete cleanData[field.name]` here, which silently
      // stripped such fields from every localized (public/frontend) response while the admin — which
      // reads with rawLocalized:true — still saw them. That broke routing: `pages.slug` is marked
      // admin.hidden purely to avoid a duplicate permalink editor, so the frontend received pages with
      // NO slug and every slug-routed static page (login, about, contact, cart, …) fell back to the
      // generic block flow. Field visibility belongs to access control, not to an admin-UI flag.
      let value = cleanData[field.name];
      if (field.type === 'array' && typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          value = [];
        }
      }

      if (field.localized) {
        const localeMap = this.parseLocaleMap(value);
        
        if (options.rawLocalized) {
           // Keep legacy non-map values visible in admin raw mode instead of collapsing to {}.
           value = localeMap ?? value ?? {};
        } else if (localeMap) {
          // Resolve best fit from chain
          let foundValue = null;
          for (const locale of options.localeContext.chain) {
            if (CoreServices.getInstance().localization.isMeaningful(localeMap[locale])) {
              foundValue = localeMap[locale];
              break;
            }
          }
          
          if (foundValue === null) {
            foundValue = localeMap[options.localeContext.defaultLocale] || null;
          }
          
          value = foundValue;
        }
      }

      cleanData[field.name] = value;
    });

    return cleanData;
  }
}