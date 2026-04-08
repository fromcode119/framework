import { AdminServices } from '@/lib/admin-services';
import { CoercionUtils } from '@fromcode119/core/client';

/**
 * Utility class for collection edit operations.
 * Handles revision deserialization, text normalization, and payload transformation.
 */
export class CollectionEditUtils {
  static normalizeCollectionFormData(
    payload: Record<string, any>,
    fields: any[]
  ): Record<string, any> {
    if (!payload || typeof payload !== 'object' || !Array.isArray(fields)) return payload;

    const nextPayload = { ...payload };

    fields.forEach((field: any) => {
      const fieldName = String(field?.name || '').trim();
      if (!fieldName || !(fieldName in nextPayload)) return;

      if (field?.type !== 'checkbox' && field?.type !== 'boolean') {
        return;
      }

      const normalized = CoercionUtils.toBoolean(nextPayload[fieldName], undefined);
      if (normalized !== undefined) {
        nextPayload[fieldName] = normalized;
      }
    });

    return nextPayload;
  }

  /**
   * Revives serialized revision values by parsing JSON strings recursively.
   * 
   * @param value - Value to revive (can be string, object, array)
   * @returns Revived value with JSON strings parsed
   * 
   * @example
   * const revived = CollectionEditUtils.reviveSerializedRevisionValue('{"title":"Hello"}');
   * // => { title: "Hello" }
   */
  static reviveSerializedRevisionValue(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => CollectionEditUtils.reviveSerializedRevisionValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [
          key,
          CollectionEditUtils.reviveSerializedRevisionValue(nested)
        ])
      );
    }

    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    const isStructuredJson =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'));

    if (!isStructuredJson) return value;

    try {
      const parsed = JSON.parse(trimmed);
      return CollectionEditUtils.reviveSerializedRevisionValue(parsed);
    } catch {
      return value;
    }
  }

  /**
   * Normalizes scalar text values, handling localized objects.
   * 
   * @param value - Value to normalize
   * @param preferredLocale - Preferred locale code
   * @returns Normalized text string
   * 
   * @example
   * const text = CollectionEditUtils.normalizeScalarText({ en: 'Hello' }, 'en'); // "Hello"
   * const simple = CollectionEditUtils.normalizeScalarText('Direct', 'en'); // "Direct"
   */
  static normalizeScalarText(value: any, preferredLocale: string): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return AdminServices.getInstance().localization.resolveLocalizedText(value, preferredLocale);
  }

  /**
   * Normalizes collection submit payload by converting localized objects to scalars.
   * 
   * @param payload - Form payload to normalize
   * @param fields - Field definitions
   * @param preferredLocaleFallback - Fallback locale code
   * @returns Normalized payload
   * 
   * @example
   * const normalized = CollectionEditUtils.normalizeCollectionSubmitPayload(
   *   { title: { en: 'Hello' }, locale: 'en' },
   *   [{ name: 'title', type: 'text', localized: false }],
   *   'en'
   * );
   * // => { title: "Hello", locale: 'en' }
   */
  static normalizeCollectionSubmitPayload(
    payload: Record<string, any>,
    fields: any[],
    preferredLocaleFallback: string
  ): Record<string, any> {
    if (!payload || typeof payload !== 'object' || !Array.isArray(fields)) return payload;

    const nextPayload = { ...payload };
    const preferredLocale = AdminServices.getInstance().localization.normalizeLocaleCode(
      nextPayload?.locale || preferredLocaleFallback
    );

    fields.forEach((field: any) => {
      const fieldName = String(field?.name || '').trim();
      if (!fieldName || !(fieldName in nextPayload)) return;

      const value = nextPayload[fieldName];
      if (value === undefined) return;

      switch (field?.type) {
        case 'text':
        case 'textarea':
        case 'code':
        case 'date':
        case 'datetime':
        case 'color':
        case 'select':
          if (!field?.localized && value && typeof value === 'object') {
            nextPayload[fieldName] = CollectionEditUtils.normalizeScalarText(value, preferredLocale);
          }
          break;
        case 'number':
          if (value && typeof value === 'object') {
            const resolved = CollectionEditUtils.normalizeScalarText(value, preferredLocale).trim();
            nextPayload[fieldName] = resolved === '' ? null : Number(resolved);
          }
          break;
        case 'checkbox':
        case 'boolean':
          if (value && typeof value === 'object') {
            const resolved = CollectionEditUtils.normalizeScalarText(value, preferredLocale)
              .trim()
              .toLowerCase();
            nextPayload[fieldName] = ['true', '1', 'yes', 'on'].includes(resolved);
          }
          break;
        default:
          break;
      }
    });

    return nextPayload;
  }
}
