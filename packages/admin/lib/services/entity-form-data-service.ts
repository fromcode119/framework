import { EntityValueParserService } from '@fromcode119/core/client';
import type { Collection } from '@fromcode119/core/client';

export class EntityFormDataService {
  private readonly parser = new EntityValueParserService();
  private static readonly READ_ONLY_OVERRIDE_SYSTEM_FIELDS = new Set(['createdAt', 'updatedAt']);

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
      ...this.extractUnlockedSystemFields(collection, payload, preservedMetadata),
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

  private extractUnlockedSystemFields(
    collection: Collection,
    payload: Record<string, any>,
    preservedMetadata: Record<string, any>,
  ): Record<string, any> {
    const unlockedFields = this.readUnlockedFieldNames(preservedMetadata._readOnlyOverride);
    if (!unlockedFields.size) {
      return {};
    }

    const systemFields: Record<string, any> = {};
    for (const field of collection.fields || []) {
      const fieldName = String(field?.name || '').trim();
      if (!fieldName || !EntityFormDataService.READ_ONLY_OVERRIDE_SYSTEM_FIELDS.has(fieldName)) {
        continue;
      }
      if (!unlockedFields.has(fieldName) || !Object.prototype.hasOwnProperty.call(payload, fieldName)) {
        continue;
      }
      systemFields[fieldName] = payload[fieldName];
    }

    return systemFields;
  }

  private readUnlockedFieldNames(readOnlyOverride: unknown): Set<string> {
    const fields = Array.isArray((readOnlyOverride as { fields?: unknown[] } | null | undefined)?.fields)
      ? (readOnlyOverride as { fields: unknown[] }).fields
      : [];

    return new Set(
      fields
        .map((fieldName) => String(fieldName || '').trim())
        .filter(Boolean)
    );
  }
}
