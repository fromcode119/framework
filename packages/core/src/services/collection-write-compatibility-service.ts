import type { IDatabaseManager } from '@fromcode119/database';
import { StringUtils } from '../string-utils';
import type { CollectionQueryInterface, UpsertByCandidatesOptions } from '../types';
import { BaseService } from './base-service';
import { CollectionService } from './collection-service';

export class CollectionWriteCompatibilityService extends BaseService {
  private static readonly DEFAULT_MAX_ATTEMPTS = 8;

  private readonly unsupportedFieldsByTarget = new Map<string, Set<string>>();

  constructor(private readonly collectionService: CollectionService = new CollectionService()) {
    super();
  }

  get serviceName(): string {
    return 'CollectionWriteCompatibilityService';
  }

  async findAndUpsert(
    collection: CollectionQueryInterface,
    candidates: string[],
    data: Record<string, any>,
    options?: UpsertByCandidatesOptions & { targetKey?: string; maxAttempts?: number },
  ): Promise<{ record: any; created: boolean }> {
    const targetKey = this.resolveTargetKey(collection, options?.targetKey);
    const existing = await this.collectionService.findByCandidates(collection, candidates, options);
    let attempts = 0;
    let nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
    const maxAttempts = options?.maxAttempts ?? CollectionWriteCompatibilityService.DEFAULT_MAX_ATTEMPTS;
    const idField = options?.idField || 'id';

    while (attempts < maxAttempts) {
      if (!this.hasWritableFields(nextPayload)) {
        if (existing) {
          return { record: existing, created: false };
        }
        throw new Error(`Compatible payload for "${targetKey}" is empty after removing unsupported fields.`);
      }

      try {
        if (existing) {
          const where =
            (typeof options?.updateWhere === 'function' && options.updateWhere(existing)) ||
            (existing?.[idField] !== undefined ? { [idField]: existing[idField] } : { slug: existing?.slug });
          const updated = await collection.update(where, nextPayload);
          return { record: updated, created: false };
        }

        try {
          const created = await collection.insert(nextPayload);
          return { record: created, created: true };
        } catch (insertErr) {
          const retryExisting = await this.collectionService.findByCandidates(collection, candidates, {
            fields: options?.fields,
            scanLimit: Math.max(options?.scanLimit ?? 2000, 5000),
          });
          if (retryExisting) {
            const where =
              (typeof options?.updateWhere === 'function' && options.updateWhere(retryExisting)) ||
              (retryExisting?.[idField] !== undefined ? { [idField]: retryExisting[idField] } : { slug: retryExisting?.slug });
            const updated = await collection.update(where, nextPayload);
            return { record: updated, created: false };
          }
          throw insertErr;
        }
      } catch (error: any) {
        const missingField = this.extractMissingColumn(error);
        if (!missingField) throw error;
        if (!this.registerUnsupportedField(targetKey, missingField)) throw error;
        nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
        attempts += 1;
      }
    }

    throw new Error(`Failed to write compatible payload for "${targetKey}": too many unsupported fields detected.`);
  }

  async updateCollection(
    collection: CollectionQueryInterface,
    where: Record<string, any>,
    data: Record<string, any>,
    options?: { targetKey?: string; maxAttempts?: number },
  ): Promise<any | null> {
    const targetKey = this.resolveTargetKey(collection, options?.targetKey);
    let attempts = 0;
    let nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
    const maxAttempts = options?.maxAttempts ?? CollectionWriteCompatibilityService.DEFAULT_MAX_ATTEMPTS;

    while (attempts < maxAttempts) {
      if (!this.hasWritableFields(nextPayload)) {
        return null;
      }

      try {
        return await collection.update(where, nextPayload);
      } catch (error: any) {
        const missingField = this.extractMissingColumn(error);
        if (!missingField) throw error;
        if (!this.registerUnsupportedField(targetKey, missingField)) throw error;
        nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
        attempts += 1;
      }
    }

    throw new Error(`Failed to update compatible payload for "${targetKey}": too many unsupported fields detected.`);
  }

  async insertRecord(
    db: IDatabaseManager,
    table: string,
    data: Record<string, any>,
    options?: { targetKey?: string; maxAttempts?: number },
  ): Promise<any> {
    const targetKey = this.resolveTableTargetKey(table, options?.targetKey);
    let attempts = 0;
    let nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
    const maxAttempts = options?.maxAttempts ?? CollectionWriteCompatibilityService.DEFAULT_MAX_ATTEMPTS;

    while (attempts < maxAttempts) {
      if (!this.hasWritableFields(nextPayload)) {
        throw new Error(`Compatible payload for "${targetKey}" is empty after removing unsupported fields.`);
      }

      try {
        return await db.insert(table, nextPayload);
      } catch (error: any) {
        const missingField = this.extractMissingColumn(error);
        if (!missingField) throw error;
        if (!this.registerUnsupportedField(targetKey, missingField)) throw error;
        nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
        attempts += 1;
      }
    }

    throw new Error(`Failed to insert compatible payload for "${targetKey}": too many unsupported fields detected.`);
  }

  async updateRecord(
    db: IDatabaseManager,
    table: string,
    where: Record<string, any>,
    data: Record<string, any>,
    options?: { targetKey?: string; maxAttempts?: number },
  ): Promise<any | null> {
    const targetKey = this.resolveTableTargetKey(table, options?.targetKey);
    let attempts = 0;
    let nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
    const maxAttempts = options?.maxAttempts ?? CollectionWriteCompatibilityService.DEFAULT_MAX_ATTEMPTS;

    while (attempts < maxAttempts) {
      if (!this.hasWritableFields(nextPayload)) {
        return null;
      }

      try {
        return await db.update(table, where, nextPayload);
      } catch (error: any) {
        const missingField = this.extractMissingColumn(error);
        if (!missingField) throw error;
        if (!this.registerUnsupportedField(targetKey, missingField)) throw error;
        nextPayload = this.cloneWithoutUnsupportedFields(targetKey, data);
        attempts += 1;
      }
    }

    throw new Error(`Failed to update compatible payload for "${targetKey}": too many unsupported fields detected.`);
  }

  private resolveTargetKey(collection: CollectionQueryInterface, explicitTargetKey?: string): string {
    return String(explicitTargetKey || (collection as any)?.slug || (collection as any)?.label || 'collection').trim();
  }

  private resolveTableTargetKey(table: string, explicitTargetKey?: string): string {
    return String(explicitTargetKey || table || 'table').trim();
  }

  private cloneWithoutUnsupportedFields<T extends Record<string, any>>(targetKey: string, payload: T): T {
    const next = { ...(payload || {}) } as Record<string, any>;
    for (const field of this.getUnsupportedFields(targetKey)) {
      delete next[field];
      delete next[StringUtils.toSnakeCase(field)];
      delete next[StringUtils.toCamelCase(field)];
    }
    return next as T;
  }

  private getUnsupportedFields(targetKey: string): Set<string> {
    const normalizedTargetKey = String(targetKey || '').trim() || 'default';
    if (!this.unsupportedFieldsByTarget.has(normalizedTargetKey)) {
      this.unsupportedFieldsByTarget.set(normalizedTargetKey, new Set<string>());
    }
    return this.unsupportedFieldsByTarget.get(normalizedTargetKey)!;
  }

  private hasWritableFields(payload: Record<string, any>): boolean {
    return Object.keys(payload || {}).length > 0;
  }

  private extractMissingColumn(error: any): string {
    const message = String(error?.message || '');
    const lower = message.toLowerCase();

    if (lower.includes('no column named')) {
      const sqliteInsertMatch = message.match(/no column named ([a-z0-9_]+)/i);
      if (sqliteInsertMatch) return String(sqliteInsertMatch[1] || '').trim();
    }

    if (lower.includes('no such column')) {
      const sqliteColumnMatch = message.match(/no such column[:\s]+([a-z0-9_]+)/i);
      if (sqliteColumnMatch) return String(sqliteColumnMatch[1] || '').trim();
    }

    if (lower.includes('column') && lower.includes('does not exist')) {
      const missingColumnMatch = message.match(/column "([^"]+)"/i);
      if (missingColumnMatch) return String(missingColumnMatch[1] || '').trim();
    }

    return '';
  }

  private registerUnsupportedField(targetKey: string, field: string): boolean {
    const normalized = String(field || '').trim();
    if (!normalized) return false;
    const fields = this.getUnsupportedFields(targetKey);
    const beforeSize = fields.size;
    fields.add(normalized);
    fields.add(StringUtils.toCamelCase(normalized));
    fields.add(StringUtils.toSnakeCase(normalized));
    return fields.size > beforeSize;
  }
}
