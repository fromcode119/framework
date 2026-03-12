import { LocalizationUtils } from '@fromcode119/core/client';


export class LocaleRegistryUtils {
  static parseLocaleRegistry(settings: Record<string, any>) {
      const parsed: Array<{ code: string; label: string }> = [];
      const raw = settings?.localization_locales;

      const ingestItems = (items: any[]) => {
        items.forEach((item: any) => {
          const code = LocalizationUtils.normalizeLocaleCode(item?.code || item?.isoCode || item?.locale);
          if (!code) return;
          if (item?.enabled === false) return;
          parsed.push({
            code,
            label: String(item?.name || code)
          });
        });
      };

      if (Array.isArray(raw)) {
        ingestItems(raw);
      } else if (typeof raw === 'string' && raw.trim()) {
        try {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) ingestItems(items);
        } catch {
          // no-op
        }
      } else if (raw && typeof raw === 'object') {
        const values = Object.values(raw);
        if (values.length && values.every((item) => item && typeof item === 'object')) {
          ingestItems(values as any[]);
        }
      }

      if (!parsed.length) {
        String(settings?.enabled_locales || 'en')
          .split(',')
          .map((value) => LocalizationUtils.normalizeLocaleCode(value))
          .filter(Boolean)
          .forEach((code) => parsed.push({ code, label: code.toUpperCase() }));
      }

      if (!parsed.length) parsed.push({ code: 'en', label: 'English' });
      return parsed;

  }
}