import { ICollection, SystemConstants, SystemSettingsExposureUtils } from '@fromcode119/core';
import { sql } from '@fromcode119/database';

/**
 * `_system_meta` is reachable through the generic collection REST API as well (the `settings`
 * collection maps straight onto that table), so the redaction that `/system/admin/settings` applies
 * has to hold on that door too — otherwise `GET /collections/settings` (and its `/export`) hands the
 * caller every row the settings endpoint deliberately withholds: live `auth:password_reset_token:*`
 * values, `user:<id>:totp_secret`, `user:<id>:2fa_recovery_codes`, api tokens, and the
 * `integration_*` credential blobs.
 *
 * The list guard is a WHERE fragment rather than a post-filter so `docs`, `totalDocs`, pagination and
 * CSV export all agree; single-record reads and writes re-apply the same allow-list per key. It keys
 * off the TABLE, not the collection slug — renaming or re-registering the collection cannot step
 * around it. The exposable set is the same framework-owned allow-list the settings endpoint uses, so
 * an undeclared key is excluded by default.
 *
 * Writes are held to the same list: `/system/admin/settings` accepts only declared, writable keys, so
 * the collection API must not be the way to mint an `auth:password_reset_token:<user>` row, overwrite
 * `scim:token`, or clear another operator's `user:<id>:totp_secret`.
 */
export class SystemMetaCollectionGuard {
  /** True when this collection reads the framework's system meta table and must be restricted. */
  static guards(collection: ICollection): boolean {
    return collection?.tableName === SystemConstants.TABLE.META;
  }

  /** Whether a single fetched row may be returned — the per-record form of the clause below. */
  static allowsRecord(collection: ICollection, record: Record<string, unknown> | null): boolean {
    if (!SystemMetaCollectionGuard.guards(collection)) {
      return true;
    }
    return !!record && SystemSettingsExposureUtils.isExposable(record.key);
  }

  /**
   * Reject a create/update/delete aimed at a system meta row that is not a declared setting. Throws a
   * 403 so the caller sees a refusal rather than a silent no-op.
   */
  static ensureWritableKey(collection: ICollection, key: unknown): void {
    if (!SystemMetaCollectionGuard.guards(collection)) {
      return;
    }
    if (SystemSettingsExposureUtils.isExposable(key)) {
      return;
    }
    const error = new Error(
      'Only declared system settings can be written through the collection API.',
    ) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  /** The clause every read of the system meta table must carry, or `null` for any other collection. */
  static buildReadClause(collection: ICollection): any {
    if (!SystemMetaCollectionGuard.guards(collection)) {
      return null;
    }

    const exposableKeys = Array.from(SystemSettingsExposureUtils.getExposableKeys());
    if (!exposableKeys.length) {
      // Nothing is declared exposable — return no rows rather than falling through to "no filter".
      return sql`1 = 0`;
    }

    const keyList = sql.join(exposableKeys.map((key) => sql`${key}`), sql`, `);
    return sql`${sql.identifier('key')} IN (${keyList})`;
  }
}
