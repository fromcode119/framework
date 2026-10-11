import type { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';

/**
 * The accounts that exist only for one site: an active member there, a member of no other site in
 * any state, and not a platform admin. When the site is deleted they go with it — they are the
 * site's own people (a shop's customers, a migration's imported accounts), and nothing else on the
 * platform knows them. The site's archive carries exactly these accounts (its active members), so a
 * restore brings them back.
 *
 * Accounts and memberships are platform tables with no row-level policy: the "no other site" test
 * sees every site's memberships even while the eraser works inside one site.
 */
export class TenantOwnAccounts {
  constructor(private readonly db: IDatabaseManager) {}

  /** Read BEFORE the site's memberships are deleted — afterwards nothing ties an account to it. */
  async ids(tenantId: string): Promise<number[]> {
    const memberships = TenantSql.identifier(SystemConstants.TABLE.TENANT_MEMBERSHIPS);
    const users = TenantSql.identifier(SystemConstants.TABLE.USERS);
    const rows = await this.db.queryRaw(
      `SELECT DISTINCT u.id FROM ${memberships} m JOIN ${users} u ON u.id::text = m.user_id
        WHERE m.tenant_id = $1 AND m.state = 'active' AND u.is_platform_admin IS NOT TRUE
          AND NOT EXISTS (SELECT 1 FROM ${memberships} o WHERE o.user_id = m.user_id AND o.tenant_id <> $1)`,
      [tenantId],
    );
    return rows.map((row: Record<string, unknown>) => Number(row.id)).filter((id: number) => Number.isInteger(id));
  }

  /** Their sessions and role grants go with them (foreign keys cascade). Returns how many. */
  async remove(ids: number[]): Promise<number> {
    if (!ids.length) return 0;
    await this.db.queryRaw(`DELETE FROM ${TenantSql.identifier(SystemConstants.TABLE.USERS)} WHERE id = ANY($1::int[])`, [ids]);
    return ids.length;
  }
}
