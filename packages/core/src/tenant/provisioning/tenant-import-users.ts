import type { IDatabaseManager } from '@fromcode119/database';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';

/**
 * The archive's users become accounts on this platform — the Google model from T1: ONE account per
 * email, many memberships. An email that already exists here is matched (case-insensitively) and
 * keeps its own password and profile; the archive's row is not applied over it. A new email is
 * created with the archived password HASH, so the person signs in as before.
 *
 * Every archived user id is recorded in the remap under `users`, so `people.user_id`, authorship
 * columns and the membership grant all land on the right account. `is_platform_admin` is never
 * written: it is not in the archive, and would not be honoured if it were.
 */
export class TenantImportUsers {
  constructor(private readonly db: IDatabaseManager) {}

  /** Returns how many accounts were CREATED (matched ones are counted by the membership grant). */
  async run(reader: TenantArchiveReader, remap: TenantIdRemap, warnings: string[]): Promise<number> {
    let created = 0;
    remap.markRemapped(SystemConstants.TABLE.USERS);
    for await (const user of reader.users()) {
      const email = CoercionUtils.toKey(user.email);
      if (!email) {
        warnings.push(`A user row without an email (archived id ${CoercionUtils.toString(user.id)}) was skipped.`);
        continue;
      }
      const existing = await this.db.queryRaw(
        `SELECT id FROM ${TenantSql.identifier(SystemConstants.TABLE.USERS)} WHERE lower(email) = $1 LIMIT 1`, [email],
      );
      if (existing[0]) {
        remap.set(SystemConstants.TABLE.USERS, user.id, existing[0].id);
        continue;
      }
      // Raw, so the insert is part of the import's transaction: `insert()` goes through drizzle's own
      // pool and would survive a rollback as an account with no site.
      const inserted = await this.db.queryRaw(
        `INSERT INTO ${TenantSql.identifier(SystemConstants.TABLE.USERS)} `
        + '(email, username, password, roles, permissions, first_name, last_name, is_platform_admin) '
        + 'VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id',
        [
          email,
          CoercionUtils.toString(user.username) || email,
          CoercionUtils.toString(user.password),
          JSON.stringify(Array.isArray(user.roles) ? user.roles : []),
          JSON.stringify(Array.isArray(user.permissions) ? user.permissions : TenantImportUsers.parseList(user.permissions)),
          CoercionUtils.toString(user.first_name) || null,
          CoercionUtils.toString(user.last_name) || null,
        ],
      );
      remap.set(SystemConstants.TABLE.USERS, user.id, inserted[0]?.id);
      created += 1;
    }
    return created;
  }

  private static parseList(value: unknown): unknown[] {
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
