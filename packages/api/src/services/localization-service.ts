import { Collection, SystemConstants } from '@fromcode119/core';
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
    if (!entries.every(([key]) => LocalizationUtils.isLocaleMap(key))) return null;

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

  public serializeLocaleMap(field: any, map: Record<string, any>): any {
    if (this.isJsonStorageField(String(field?.type || ''))) {
      return map;
    }
    return JSON.stringify(map);
  }

  public async getLocaleContext(req: any): Promise<{
    locale: string;
    defaultLocale: string;
    fallbackLocale: string;
    chain: string[];
  }> {
    if (req?._fcLocaleContext) return req._fcLocaleContext;

    let settingsMap: Record<string, any> = {};
    try {
      const settingsRows = await this.db.find(SystemConstants.TABLE.META);
      if (Array.isArray(settingsRows)) {
        settingsRows.forEach((row: any) => {
          if (row.key) settingsMap[row.key] = row.value;
        });
      }
    } catch {
      // Fall back to defaults if metadata fetch fails.
    }

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
    collection: Collection,
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
      if (field.admin?.hidden) {
        delete cleanData[field.name];
        return;
      }

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