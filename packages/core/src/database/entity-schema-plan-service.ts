import { createHash } from 'crypto';
import type { Collection, Field } from '../types';
import type { EntitySchemaPlan } from './entity-schema-plan.interfaces';

export class EntitySchemaPlanService {
  buildPlan(collection: Collection, exists: boolean, existingColumns: string[]): EntitySchemaPlan {
    const existing = new Set(existingColumns.map((column) => column.toLowerCase()));

    return {
      collection,
      tableName: collection.slug,
      fingerprint: this.createFingerprint(collection),
      exists,
      missingColumns: exists
        ? this.resolveSyncableFields(collection)
          .filter((field) => !existing.has(this.toColumnName(field.name).toLowerCase()))
          .map((field) => ({ field, columnName: this.toColumnName(field.name) }))
        : [],
      unsupportedIndexes: this.resolveUnsupportedIndexes(collection),
    };
  }

  createFingerprint(collection: Collection): string {
    const payload = {
      slug: collection.slug,
      fields: this.resolveSyncableFields(collection).map((field) => ({
        name: field.name,
        type: field.type,
        required: Boolean(field.required),
        unique: Boolean(field.unique),
        localized: Boolean(field.localized),
        relationTo: field.relationTo || null,
        hasMany: Boolean(field.hasMany),
      })),
      indexes: (collection.indexes || []).map((index) => ({
        name: index.name || '',
        fields: [...index.fields].sort(),
        unique: Boolean(index.unique),
      })),
    };

    return createHash('sha256').update(this.stableStringify(payload)).digest('hex');
  }

  toColumnName(value: string): string {
    return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  private resolveSyncableFields(collection: Collection): Field[] {
    return (collection.fields || []).filter((field) => field.name !== 'id');
  }

  private resolveUnsupportedIndexes(collection: Collection): string[] {
    return (collection.indexes || [])
      .filter((index) => index.fields.length > 0)
      .map((index) => index.name || `${collection.slug}_${index.fields.join('_')}_idx`);
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => {
        const nextValue = (value as Record<string, unknown>)[key];
        return `${JSON.stringify(key)}:${this.stableStringify(nextValue)}`;
      }).join(',')}}`;
    }

    return JSON.stringify(value);
  }
}
