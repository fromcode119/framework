import { AdminServices } from '@/lib/admin-services';

/**
 * Utility class for collection list view rendering operations.
 * Handles relationship field display and scalar value extraction.
 */
export class CollectionListUtils {
  static readonly BOOLEAN_FIELD_NAMES = new Set([
    'active',
    'enabled',
    'disabled',
    'verified',
    'published',
    'featured',
    'visible',
    'archived',
    'approved',
    'completed',
    'default',
    'required'
  ]);

  static areStringArraysEqual(left: string[], right: string[]): boolean {
    if (left === right) return true;
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  }

  static areStringRecordMapsEqual(left: Record<string, string>, right: Record<string, string>): boolean {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (!CollectionListUtils.areStringArraysEqual([...leftKeys].sort(), [...rightKeys].sort())) {
      return false;
    }

    return leftKeys.every((key) => left[key] === right[key]);
  }

  static parsePageQueryValue(value: string | null): number {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  static prettifyColumnName(value: string): string {
    return value
      .replace(/([A-Z])/g, ' $1')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (str) => str.toUpperCase());
  }

  static resolveCollectionLabel(collection: any, fallbackSlug: string): string {
    const displayName = String(collection?.displayName || collection?.name || '').trim();
    if (displayName) return displayName;
    return CollectionListUtils.prettifyColumnName(String(fallbackSlug || '').trim() || 'Records');
  }

  static resolveCollectionSingularLabel(collection: any, fallbackSlug: string): string {
    const label = CollectionListUtils.resolveCollectionLabel(collection, fallbackSlug);
    if (/ies$/i.test(label)) return label.replace(/ies$/i, 'y');
    if (/ses$/i.test(label)) return label.replace(/es$/i, '');
    if (/s$/i.test(label) && !/ss$/i.test(label)) return label.replace(/s$/i, '');
    return label;
  }

  static resolveCollectionSearchPlaceholder(collection: any, fallbackSlug: string): string {
    return `Search ${CollectionListUtils.resolveCollectionLabel(collection, fallbackSlug).toLowerCase()}...`;
  }

  static resolveCollectionDescription(collection: any, fallbackSlug: string): string {
    return `Manage and organize ${CollectionListUtils.resolveCollectionLabel(collection, fallbackSlug).toLowerCase()} records.`;
  }

  static resolveBooleanBadge(fieldName: string, fieldLabel: string, raw: unknown): null | { variant: 'success' | 'gray'; label: string } {
    const value = CollectionListUtils.toBooleanValue(raw);
    if (value === null) return null;

    const normalizedField = String(fieldLabel || fieldName || '').trim().toLowerCase();
    if (normalizedField === 'active') {
      return { variant: value ? 'success' : 'gray', label: value ? 'Active' : 'Inactive' };
    }
    if (normalizedField === 'enabled') {
      return { variant: value ? 'success' : 'gray', label: value ? 'Enabled' : 'Disabled' };
    }
    if (normalizedField === 'verified') {
      return { variant: value ? 'success' : 'gray', label: value ? 'Verified' : 'Unverified' };
    }
    if (normalizedField === 'published') {
      return { variant: value ? 'success' : 'gray', label: value ? 'Published' : 'Draft' };
    }

    return { variant: value ? 'success' : 'gray', label: value ? 'Yes' : 'No' };
  }

  static shouldRenderBooleanBadge(field: any, fieldName: string, fieldLabel: string, raw: unknown): boolean {
    if (field?.type === 'boolean' || field?.type === 'checkbox') return true;
    if (typeof raw === 'boolean') return true;

    const value = CollectionListUtils.toBooleanValue(raw);
    if (value === null) return false;

    const normalizedFieldName = String(fieldName || '').trim().toLowerCase();
    const normalizedFieldLabel = String(fieldLabel || '').trim().toLowerCase();
    return CollectionListUtils.BOOLEAN_FIELD_NAMES.has(normalizedFieldName)
      || CollectionListUtils.BOOLEAN_FIELD_NAMES.has(normalizedFieldLabel);
  }

  static toBooleanValue(raw: unknown): boolean | null {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') {
      if (raw === 1 || raw === 1.0) return true;
      if (raw === 0 || raw === 0.0) return false;
      return null;
    }
    const normalized = String(raw ?? '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === '1.0') return true;
    if (normalized === '0.0') return false;
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return null;
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

  static resolveRelationTarget(value: any): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    return String(
      value.relationTo ?? value.sourceCollection ?? value.collection ?? value.collectionSlug ?? ''
    ).trim();
  }
}
