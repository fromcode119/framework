import { AdminServices } from '@/lib/admin-services';

export class MediaRelationFieldUtils {
  static resolvePreviewUrl(pathOrUrl: string): string {
    return AdminServices.getInstance().media.resolveMediaUrl(pathOrUrl);
  }

  private static normalizeEntry(entry: any): any {
    if (entry && typeof entry === 'object') {
      return entry.id ?? entry._id ?? entry.value;
    }
    return entry;
  }

  private static normalizeScalarOrListString(entry: any): Array<string | number> {
    const text = String(entry ?? '').trim();
    if (!text) return [];
    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => MediaRelationFieldUtils.normalizeEntry(item))
            .filter((item) => item !== null && item !== undefined && String(item).trim().length > 0);
        }
      } catch {
        // Keep as scalar when parsing fails.
      }
    }
    return [entry];
  }

  static getSelectedIds(value: any): Array<string | number> {
    if (Array.isArray(value)) {
      return value
        .flatMap((entry) => MediaRelationFieldUtils.normalizeScalarOrListString(MediaRelationFieldUtils.normalizeEntry(entry)))
        .filter((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0);
    }

    if (value && typeof value === 'object') {
      const objectId = value.id ?? value._id ?? value.value;
      return MediaRelationFieldUtils.normalizeScalarOrListString(objectId);
    }

    return MediaRelationFieldUtils.normalizeScalarOrListString(value);
  }
}
