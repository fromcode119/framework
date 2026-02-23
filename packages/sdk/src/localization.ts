export interface NormalizeLocaleOptions {
  short?: boolean;
}

export function normalizeLocaleCode(value: any, options: NormalizeLocaleOptions = {}): string {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return '';
  if (options.short) {
    const short = raw.split('-')[0];
    return /^[a-z]{2}$/.test(short) ? short : '';
  }
  if (/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/.test(raw)) return raw;
  const short = raw.split('-')[0];
  return /^[a-z]{2}$/.test(short) ? short : '';
}

export function hasLocalizedValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export function tryParseLocalizedJsonString(value: string): Record<string, any> | null {
  const raw = String(value || '').trim();
  if (!raw.startsWith('{') || !raw.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, any>;
  } catch {
    return null;
  }
}

export function resolveLocalizedLabel(value: any, locale: string, fallback = 'en'): string {
  if (typeof value === 'string') {
    const parsed = tryParseLocalizedJsonString(value);
    if (!parsed) return value.trim();
    value = parsed;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return String(value || '').trim();
  }

  const localeCode = normalizeLocaleCode(locale, { short: true });
  const fallbackCode = normalizeLocaleCode(fallback, { short: true }) || 'en';

  const normalized: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const code = normalizeLocaleCode(key, { short: true });
    if (code) normalized[code] = entry;
  });

  if (hasLocalizedValue(normalized[localeCode])) return String(normalized[localeCode]).trim();
  if (hasLocalizedValue(normalized[fallbackCode])) return String(normalized[fallbackCode]).trim();
  const first = Object.values(normalized).find((entry) => hasLocalizedValue(entry));
  return first !== undefined ? String(first).trim() : '';
}

