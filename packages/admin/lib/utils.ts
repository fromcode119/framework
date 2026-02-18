import { normalizeLocaleCode, isLocaleLikeKey, resolveLocalizedText } from '@fromcode/core/utils';

export { normalizeLocaleCode, isLocaleLikeKey, resolveLocalizedText };

export const LOCALE_KEY_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

/**
 * Deep search utility that attempts to find a display name in any object/structure.
 */
export function resolveLabelText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveLabelText(item);
      if (resolved) return resolved;
    }
    return '';
  }
  if (typeof value === 'object') {
    const directKeys = ['label', 'name', 'title', 'username', 'email', 'slug', 'value', 'id'];
    for (const key of directKeys) {
      const resolved = resolveLabelText((value as any)[key]);
      if (resolved) return resolved;
    }

    const entries = Object.entries(value as Record<string, any>);
    const localeEntries = entries.filter(([key]) => LOCALE_KEY_RE.test(String(key).trim().toLowerCase()));
    for (const [, localeValue] of localeEntries) {
      const resolved = resolveLabelText(localeValue);
      if (resolved) return resolved;
    }
  }
  return '';
}

/**
 * Slugify text to URL-safe format
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Format date to localized string
 */
export function formatDate(value: any): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Normalize and sanitize string input
 */
export function normalizeString(value: any): string {
  return String(value || '').trim();
}

/**
 * Normalize string and convert to lowercase
 */
export function normalizeStringLower(value: any): string {
  return String(value || '').trim().toLowerCase();
}
