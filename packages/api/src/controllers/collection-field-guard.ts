/** CollectionFieldGuard — enforces read-only and permalink constraints. Extracted from RESTController (ARC-007). */

import { ICollection } from '@fromcode119/core';
import { CoercionUtils } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { IDatabaseManager } from '@fromcode119/database';
import { ApiUrlUtils } from '@api/utils/url';
import { ApiConfig } from '@api/config/api-config';
import { ReadOnlyOverrideGrantUtils } from '@api/utils/read-only-override-grant-utils';

export class CollectionFieldGuard {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly auth?: AuthManager,
  ) {}

  /**
   * `fields` is what the client CLAIMS it is overriding — kept for the error message and the change
   * record, never as authorization. The grant is the authorization, and it is scoped to the record.
   *
   * This used to carry the operator's account `password` in the record's own save payload, where it
   * was bcrypt-compared on every write. A grant replaces it: the credential never leaves the login
   * dialog, and a captured payload expires by itself.
   */
  extractReadOnlyOverrideMetadata(payload: any): {
    data: Record<string, any>;
    overrideMeta: { fields: Set<string>; grant: string };
  } {
    const data = payload && typeof payload === 'object' ? { ...payload } : {};
    const rawOverride = data._readOnlyOverride && typeof data._readOnlyOverride === 'object' ? data._readOnlyOverride : null;
    delete data._readOnlyOverride;
    const fields = Array.isArray(rawOverride?.fields)
      ? rawOverride.fields.map((f: any) => String(f || '').trim()).filter(Boolean)
      : [];
    return { data, overrideMeta: { fields: new Set(fields), grant: String(rawOverride?.grant || '') } };
  }

  isReadOnlyOverrideable(field: any): boolean {
    if (!field?.admin?.readOnly) return false;
    if (
      field?.admin?.readOnlyOverride === false ||
      field?.admin?.readOnlyOverride === 'never' ||
      field?.admin?.allowReadOnlyOverride === false
    ) {
      return false;
    }
    return true;
  }

  normalizeComparableValue(value: any): any {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return CoercionUtils.toSafeIsoDate(value);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      // Boolean-as-string → 0/1 so a stored TEXT 'true'/'false' (consent flags, say) compares equal
      // to a form BOOLEAN (`true` → 1). Without this, editing ANY other field on the record falsely
      // trips the "requires password override confirmation" guard on the unchanged consent field.
      const lower = trimmed.toLowerCase();
      if (lower === 'true') return 1;
      if (lower === 'false') return 0;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) { const p = new Date(trimmed); if (!Number.isNaN(p.getTime())) return p.toISOString(); }
      return trimmed;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    // Normalize booleans to 0/1 so a form value (`true`) compares equal to the SQLite-stored value
    // (`1`). Without this, saving a record with an unchanged read-only BOOLEAN field (e.g. consent flags)
    // falsely trips the "requires password override confirmation" guard on every save.
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  hasIncomingReadOnlyChange(nextValue: any, existingValue: any, hasExistingRecord: boolean): boolean {
    if (nextValue === undefined) return false;
    if (!hasExistingRecord) return false; // allow setting read-only fields on create; only block changes after creation
    return this.normalizeComparableValue(nextValue) !== this.normalizeComparableValue(existingValue);
  }

  makeClientError(message: string, statusCode: number = 400): Error & { statusCode: number } {
    const err = new Error(message) as Error & { statusCode: number };
    err.statusCode = statusCode;
    return err;
  }

  async enforceReadOnlyFieldConstraints(args: {
    collection: ICollection;
    incomingData: Record<string, any>;
    existingRecord: any | null;
    req: any;
    overrideMeta: { fields: Set<string>; grant: string };
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
      // `readOnlyOverride: 'never'` is absolute: the record-wide grant does NOT reach it. Unlocking one
      // field unlocks the record's OVERRIDEABLE fields, not everything declared read-only.
      if (!this.isReadOnlyOverrideable(field)) throw this.makeClientError(`Field "${field.label || name}" is read-only and cannot be modified.`);
      changedOverrideableFields.push(name);
    }

    if (!changedOverrideableFields.length) return;
    if (!overrideMeta.grant) throw this.makeClientError('Unlock confirmation is required to change read-only fields.');
    if (!this.auth) throw this.makeClientError('Unlock verification is unavailable.', 503);
    const userId = CoercionUtils.toRelationId(req?.user?.id);
    if (!userId) throw this.makeClientError('Authentication is required for read-only field overrides.', 401);

    // Scoped to THIS user and THIS record: a grant minted for another record, another collection or
    // another operator is refused rather than re-scoped to whatever this request happens to be.
    const granted = await this.auth.verifyGrantToken(overrideMeta.grant, {
      userId,
      purpose: ReadOnlyOverrideGrantUtils.PURPOSE,
      scope: ReadOnlyOverrideGrantUtils.scope(String(collection?.slug || ''), existingRecord?.id),
    });
    if (!granted) throw this.makeClientError('Your unlock has expired. Confirm your password again to change read-only fields.');
  }

  assertPermalinkNotReserved(collection: ICollection, data: Record<string, any>) {
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
