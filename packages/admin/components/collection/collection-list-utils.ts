import { AdminServices } from '@/lib/admin-services';

/**
 * Utility class for collection list view rendering operations.
 * Handles relationship field display and scalar value extraction.
 */
export class CollectionListUtils {
  static parsePageQueryValue(value: string | null): number {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  static prettifyColumnName(value: string): string {
    return value
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (str) => str.toUpperCase());
  }

  static formatCellValue(raw: unknown): string {
    const loc = AdminServices.getInstance().localization;
    if (raw === null || raw === undefined || raw === '') return '-';
    if (typeof raw === 'string') {
      const parsed = loc.tryParseLocaleJson(raw);
      if (parsed && loc.isLocaleMap(parsed)) return loc.resolveAnyString(parsed) || '-';
      return raw;
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (Array.isArray(raw)) {
      if (!raw.length) return '-';
      const sample = raw.slice(0, 3).map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return String(item);
        if (item && typeof item === 'object') {
          if (loc.isLocaleMap(item)) return loc.resolveAnyString(item);
          const objectItem = item as Record<string, unknown>;
          return String(objectItem.title || objectItem.name || objectItem.label || objectItem.slug || objectItem.id || '[item]');
        }
        return String(item);
      });
      return sample.join(', ') + (raw.length > 3 ? '…' : '');
    }
    if (typeof raw === 'object') {
      if (loc.isLocaleMap(raw)) return loc.resolveAnyString(raw) || '-';
      const objectRaw = raw as Record<string, unknown>;
      return String(objectRaw.title || objectRaw.name || objectRaw.label || objectRaw.slug || objectRaw.id || '[Object]');
    }
    return String(raw);
  }

  /**
   * Resolves a display label from a relationship field value.
   * 
   * @param value - The relationship field value (can be object, string, number)
   * @returns Human-readable display label
   * 
   * @example
   * const label = CollectionListUtils.resolveRelationDisplayLabel({ title: 'Hello' }); // "Hello"
   * const label2 = CollectionListUtils.resolveRelationDisplayLabel('direct-value'); // "direct-value"
   */
  static resolveRelationDisplayLabel(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) return '';
    if (typeof value === 'object') {
      return String(
        value.title || value.name || value.label || value.slug || 
        value.email || value.username || value.id || ''
      ).trim();
    }
    return '';
  }

  /**
   * Resolves a scalar value from a relationship field.
   * 
   * @param value - The relationship field value
   * @returns Scalar value (typically ID or slug)
   * 
   * @example
   * const id = CollectionListUtils.resolveRelationScalar({ id: 123 }); // "123"
   * const slug = CollectionListUtils.resolveRelationScalar({ slug: 'hello' }); // "hello"
   */
  static resolveRelationScalar(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }
    if (typeof value === 'boolean') return '';
    if (typeof value === 'object') {
      return String(value.id ?? value._id ?? value.value ?? value.slug ?? '').trim();
    }
    return String(value).trim();
  }
}
