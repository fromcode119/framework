import { EntityValueParserService } from '@fromcode119/core/client';
import type { Collection } from '@fromcode119/core/client';

export class EntityFormDataService {
  private readonly parser = new EntityValueParserService();

  normalizeSubmitPayload(
    collection: Collection | null | undefined,
    payload: Record<string, any>,
    options: { isNew?: boolean } = {},
  ): Record<string, any> {
    if (!collection || !payload || typeof payload !== 'object') {
      return payload;
    }

    const preservedMetadata = this.extractSubmitMetadata(payload);
    const parsed = this.parser.parseCollectionInput(collection, payload, {
      mode: options.isNew ? 'create' : 'update',
    });

    return {
      ...parsed.data,
      ...preservedMetadata,
    };
  }

  normalizeLoadedRecord(collection: Collection | null | undefined, payload: Record<string, any>): Record<string, any> {
    if (!collection || !payload || typeof payload !== 'object') {
      return payload;
    }

    const nextPayload = { ...payload };
    for (const field of collection.fields || []) {
      const fieldName = String(field?.name || '').trim();
      if (!fieldName || !(fieldName in nextPayload)) {
        continue;
      }
      if (field.type !== 'checkbox' && field.type !== 'boolean') {
        continue;
      }
      const parsed = this.parser.parseCollectionInput(collection, { [fieldName]: nextPayload[fieldName] }, { mode: 'update' });
      if (Object.prototype.hasOwnProperty.call(parsed.data, fieldName)) {
        nextPayload[fieldName] = parsed.data[fieldName];
      }
    }
    return nextPayload;
  }

  private extractSubmitMetadata(payload: Record<string, any>): Record<string, any> {
    const metadata: Record<string, any> = {};
    if (payload._readOnlyOverride !== undefined) {
      metadata._readOnlyOverride = payload._readOnlyOverride;
    }
    if (payload._change_summary !== undefined) {
      metadata._change_summary = payload._change_summary;
    }
    return metadata;
  }
}
