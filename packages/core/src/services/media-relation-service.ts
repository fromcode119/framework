import { BaseService } from '../base/base-service';
import { CoercionUtils } from '../coercion-utils';

export class MediaRelationService extends BaseService {
  async loadRecords(values: unknown[]): Promise<Map<string, any>> {
    const ids = this.extractIds(values);
    const mediaRecords = new Map<string, any>();

    await Promise.all(ids.map(async (id) => {
      const record = await this.context.db.findOne('media', { id: Number(id) });
      if (record) {
        mediaRecords.set(id, record);
      }
    }));

    return mediaRecords;
  }

  extractIds(values: unknown[]): string[] {
    const ids = new Set<string>();

    for (const value of values) {
      const id = this.extractId(value);
      if (id) {
        ids.add(id);
      }
    }

    return Array.from(ids);
  }

  extractId(value: unknown): string {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim();
    if (!value || typeof value !== 'object') return '';

    const objectValue = value as Record<string, any>;
    const candidates = [objectValue.id, objectValue._id, objectValue.value, objectValue.mediaId, objectValue.file?.id];

    for (const candidate of candidates) {
      const normalized = CoercionUtils.toString(candidate);
      if (normalized && /^\d+$/.test(normalized)) return normalized;
    }

    return '';
  }
}