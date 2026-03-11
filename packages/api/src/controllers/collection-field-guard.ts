/** CollectionFieldGuard — enforces read-only and permalink constraints. Extracted from RESTController (ARC-007). */

import { Collection } from '@fromcode119/core';
import { CoercionUtils } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { IDatabaseManager } from '@fromcode119/database';
import { ApiUrlUtils } from '../utils/url';
import { ApiConfig } from '../config/api-config';

export class CollectionFieldGuard {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly auth?: AuthManager,
  ) {}

  extractReadOnlyOverrideMetadata(payload: any): {
    data: Record<string, any>;
    overrideMeta: { fields: Set<string>; password: string };
  } {
    const data = payload && typeof payload === 'object' ? { ...payload } : {};
    const rawOverride = data._readOnlyOverride && typeof data._readOnlyOverride === 'object' ? data._readOnlyOverride : null;
    delete data._readOnlyOverride;
    const fields = Array.isArray(rawOverride?.fields)
      ? rawOverride.fields.map((f: any) => String(f || '').trim()).filter(Boolean)
      : [];
    return { data, overrideMeta: { fields: new Set(fields), password: String(rawOverride?.password || '') } };
  }

  isReadOnlyOverrideable(field: any): boolean {
    return Boolean(field?.admin?.readOnly && (field?.admin?.readOnlyOverride === 'password' || field?.admin?.allowReadOnlyOverride === true));
  }

  normalizeComparableValue(value: any): any {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return CoercionUtils.toSafeIsoDate(value);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) { const p = new Date(trimmed); if (!Number.isNaN(p.getTime())) return p.toISOString(); }
      return trimmed;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  hasIncomingReadOnlyChange(nextValue: any, existingValue: any, hasExistingRecord: boolean): boolean {
    if (nextValue === undefined) return false;
    if (!hasExistingRecord) return this.normalizeComparableValue(nextValue) !== null;
    return this.normalizeComparableValue(nextValue) !== this.normalizeComparableValue(existingValue);
  }

  makeClientError(message: string, statusCode: number = 400): Error & { statusCode: number } {
    const err = new Error(message) as Error & { statusCode: number };
    err.statusCode = statusCode;
    return err;
  }

  async enforceReadOnlyFieldConstraints(args: {
    collection: Collection;
    incomingData: Record<string, any>;
    existingRecord: any | null;
    req: any;
    overrideMeta: { fields: Set<string>; password: string };
  }) {
    const { collection, incomingData, existingRecord, req, overrideMeta } = args;
    if (!incomingData || typeof incomingData !== 'object') return;
    const changedOverrideableFields: string[] = [];
    const hasExistingRecord = Boolean(existingRecord);

    for (const field of collection.fields || []) {
      if (!field?.admin?.readOnly) continue;
      const name = String(field.name || '');
      if (!name || !Object.prototype.hasOwnProperty.call(incomingData, name)) continue;
      const snakeName = name.replace(/([A-Z])/g, '_$1').toLowerCase();
      const existingValue = hasExistingRecord
        ? (existingRecord?.[name] !== undefined ? existingRecord?.[name] : existingRecord?.[snakeName])
        : undefined;
      if (!this.hasIncomingReadOnlyChange(incomingData[name], existingValue, hasExistingRecord)) continue;
      if (!this.isReadOnlyOverrideable(field)) throw this.makeClientError(`Field "${field.label || name}" is read-only and cannot be modified.`);
      if (!overrideMeta.fields.has(name)) throw this.makeClientError(`Field "${field.label || name}" requires password override confirmation.`);
      changedOverrideableFields.push(name);
    }

    if (!changedOverrideableFields.length) return;
    if (!overrideMeta.password) throw this.makeClientError('Password is required for read-only field overrides.');
    if (!this.auth) throw this.makeClientError('Password verification is unavailable.', 503);
    const userId = Number.parseInt(String(req?.user?.id || ''), 10);
    if (!userId) throw this.makeClientError('Authentication is required for read-only field overrides.', 401);
    const user = await this.db.findOne('users', { id: userId });
    if (!user) throw this.makeClientError('User not found.', 404);
    const passwordMatches = await this.auth.comparePassword(String(overrideMeta.password), String(user.password || ''));
    if (!passwordMatches) throw this.makeClientError('Current password is invalid.');
  }

  assertPermalinkNotReserved(collection: Collection, data: Record<string, any>) {
    if (!collection || !data || typeof data !== 'object') return;
    const permalinkFields = ['slug', 'customPermalink', 'path', 'permalink'];
    const existingFields = new Set((collection.fields || []).map((f) => String(f?.name || '')));
    const targetFields = permalinkFields.filter((n) => existingFields.has(n) && data[n] !== undefined && data[n] !== null);
    if (!targetFields.length) return;

    const reservedRootSegments = new Set(ApiConfig.getInstance().reservedPermalinks.ROOT_SEGMENTS.map((s) => String(s).toLowerCase()));
    const reservedExactPaths = new Set(ApiConfig.getInstance().reservedPermalinks.EXACT_PATHS.map((p) => String(p).toLowerCase()));

    const extractCandidates = (value: any): string[] => {
      if (typeof value === 'string' || typeof value === 'number') return [String(value)];
      if (Array.isArray(value)) return value.flatMap((i) => extractCandidates(i));
      if (value && typeof value === 'object') return Object.values(value).flatMap((i) => extractCandidates(i));
      return [];
    };

    for (const fieldName of targetFields) {
      for (const rawValue of extractCandidates(data[fieldName])) {
        const pathValue = ApiUrlUtils.normalizePath(rawValue).toLowerCase();
        if (!pathValue || pathValue === '/') continue;
        const firstSegment = pathValue.replace(/^\/+/, '').split('/')[0] || '';
        if (reservedRootSegments.has(firstSegment) || reservedExactPaths.has(pathValue)) {
          throw new Error(`Permalink "${pathValue}" is reserved and cannot be used.`);
        }
      }
    }
  }
}
