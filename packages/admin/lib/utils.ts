import { normalizeLocaleCode, isLocaleLikeKey, resolveLocalizedText } from '@fromcode119/core/utils';
import { formatSystemDateTime } from './timezone';
import { api } from './api';

export { normalizeLocaleCode, isLocaleLikeKey, resolveLocalizedText };

export const LOCALE_KEY_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

/**
 * Formats a number of bytes into a human-readable string (KB, MB, GB, etc.)
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Resolves a media value (string) into a full URL if needed.
 */
export function resolveMediaUrl(value: any): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  return api.getURL(raw.startsWith('/') ? raw : `/${raw}`);
}

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
  return formatSystemDateTime(value);
}

/**
 * Get nested object value from string path
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Evaluates field visibility conditions from plugin schemas
 */
export function evaluateCondition(condition: any, data: any, fieldName?: string): boolean {
  if (!condition) return true;

  // Pattern: (data, siblingData)
  if (typeof condition === 'function') {
    try {
      return !!condition(data, data);
    } catch (e) {
      console.warn(`Condition function failed for ${fieldName || 'field'}:`, e);
      return true;
    }
  }

  // Handle object conditions: { field, operator, value }
  if (typeof condition !== 'object' || Array.isArray(condition)) {
    return true;
  }

  const { field: targetPath, operator, value } = condition;
  const actualValue = getNestedValue(data, targetPath);

  switch (operator) {
    case 'equals': return actualValue === value;
    case 'notEquals': return actualValue !== value;
    case 'contains': {
      if (Array.isArray(actualValue)) return actualValue.includes(value);
      return String(actualValue || '').includes(String(value));
    }
    case 'notContains': {
      if (Array.isArray(actualValue)) return !actualValue.includes(value);
      return !String(actualValue || '').includes(String(value));
    }
    case 'greaterThan': return Number(actualValue) > Number(value);
    case 'lessThan': return Number(actualValue) < Number(value);
    case 'exists': return actualValue !== undefined && actualValue !== null && actualValue !== '';
    case 'notExists': return actualValue === undefined || actualValue === null || actualValue === '';
    default: return true;
  }
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
