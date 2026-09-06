import fs from 'fs';
import { CoercionUtils } from '@core/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantArchiveSource } from '@core/tenant/provisioning/tenant-archive-source';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';

/**
 * The people who can log in to the site being exported, with the roles they hold THERE.
 *
 * On a multi-tenant source that is the membership table: the account plus its per-tenant roles. On
 * a single-tenant source every account is a member and its roles are the global `users.roles` (plus
 * `_system_users_roles`, where that table is populated). `is_platform_admin` is deliberately NOT
 * exported: an archive must never be able to mint a platform admin on the platform that imports it.
 *
 * The password HASH travels, so people keep their passwords across a migration.
 */
export class TenantArchiveUsersExport {
  private static readonly FIELDS = ['id', 'email', 'username', 'password', 'first_name', 'last_name', 'permissions', 'created_at'];

  constructor(private readonly source: TenantArchiveSource) {}

  /** Writes `users.ndjson`; returns how many. */
  async writeTo(filePath: string): Promise<number> {
    const members = await this.members();
    const out = fs.openSync(filePath, 'w');
    try {
      for (const member of members) fs.writeSync(out, `${JSON.stringify(member)}\n`);
    } finally {
      fs.closeSync(out);
    }
    return members.length;
  }

  private async members(): Promise<Array<Record<string, unknown>>> {
    const db = this.source.db;
    if (this.source.isTenant) {
      const memberships = await db.queryRaw(
        `SELECT user_id, roles FROM ${TenantSql.identifier(SystemConstants.TABLE.TENANT_MEMBERSHIPS)} WHERE tenant_id = $1 AND state = 'active'`,
        [this.source.tenantId],
      );
      const out: Array<Record<string, unknown>> = [];
      for (const membership of memberships) {
        const user = await db.findOne(SystemConstants.TABLE.USERS, { id: CoercionUtils.toString(membership.user_id) });
        if (!user) continue;
        out.push(TenantArchiveUsersExport.shape(user, TenantArchiveUsersExport.roles(membership.roles)));
      }
      return out;
    }

    const users = await db.queryRaw(`SELECT * FROM ${TenantSql.identifier(SystemConstants.TABLE.USERS)} ORDER BY id`);
    const extraRoles = await this.usersRoles();
    return users.map((user) => {
      const id = CoercionUtils.toString(user.id);
      const roles = new Set([...TenantArchiveUsersExport.roles(user.roles), ...(extraRoles.get(id) ?? [])]);
      return TenantArchiveUsersExport.shape(user, [...roles]);
    });
  }

  private async usersRoles(): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!(await this.source.db.tableExists(SystemConstants.TABLE.USERS_ROLES))) return out;
    const rows = await this.source.db.queryRaw(`SELECT user_id, role_slug FROM ${TenantSql.identifier(SystemConstants.TABLE.USERS_ROLES)}`);
    for (const row of rows) {
      const id = CoercionUtils.toString(row.user_id);
      out.set(id, [...(out.get(id) ?? []), CoercionUtils.toString(row.role_slug)]);
    }
    return out;
  }

  private static shape(user: Record<string, unknown>, roles: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of TenantArchiveUsersExport.FIELDS) {
      const value = user[field];
      out[field] = value instanceof Date ? value.toISOString() : (value ?? null);
    }
    out.roles = roles;
    return out;
  }

  /** `roles` is JSON in Postgres and a JSON STRING in SQLite; both shapes end up a string list. */
  static roles(value: unknown): string[] {
    let parsed: unknown = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch { parsed = []; }
    }
    return Array.isArray(parsed) ? parsed.map((role) => CoercionUtils.toString(role).trim()).filter(Boolean) : [];
  }
}
