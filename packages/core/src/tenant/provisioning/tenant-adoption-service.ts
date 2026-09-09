import type { IDatabaseManager } from '@fromcode119/database';
import { TenantRlsSql } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantMembershipService } from '@core/tenant/tenant-membership-service';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantArchiveUsersExport } from '@core/tenant/provisioning/tenant-archive-users-export';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Turns a running SINGLE-tenant deployment into its own first tenant, in place.
 *
 * This is the production migration path (T0 §5.2): the rows already live in this database, so
 * moving them through an archive would be pointless. Instead every row that has no owner
 * (`tenant_id IS NULL`) is stamped with the new tenant's id, every account becomes a member carrying
 * the roles it already holds, every active plugin is enabled for the tenant, the active theme is
 * activated for it. Zero NULLs must remain before FORCE row-level security goes on at the next boot —
 * one NULL row is a row that becomes invisible to everyone — so the count is checked and reported.
 *
 * Settings are the exception: `_system_meta` and `_system_plugin_settings` platform rows are COPIED
 * to the tenant (platform keys excepted), exactly as migrations 023/024 did for existing tenants, so
 * the platform keeps its own values.
 *
 * Runs on the OWNER connection with no tenant scope — there is no policy yet, the whole point. It
 * refuses to run if any tenant exists. A restart follows: `TenantMode` is decided at boot.
 */
export class TenantAdoptionService {
  private readonly logger = new Logger({ namespace: 'tenant-adoption' });

  constructor(
    private readonly db: IDatabaseManager,
    private readonly registry: TenantRegistryService,
    private readonly tables: TenantTableDescriptor[],
  ) {}

  async adopt(identity: TenantIdentity): Promise<{ tenant: TenantRecord; stamped: Record<string, number>; members: number; unassigned: Record<string, number>; restartRequired: true }> {
    if ((await this.registry.count()) > 0) {
      throw new Error('Adoption is only for a deployment with NO tenants. This one already has tenants; import a site instead.');
    }
    const tenant = await this.registry.create(identity);
    const stamped: Record<string, number> = {};
    try {
      await this.db.queryRaw('BEGIN');
      try {
        for (const table of this.tables) {
          if (!table.hasTenantColumn) continue;
          stamped[table.name] = await this.stamp(table, tenant.id);
        }
        await this.db.queryRaw('COMMIT');
      } catch (error) {
        await this.db.queryRaw('ROLLBACK').catch(() => undefined);
        throw error;
      }
    } catch (error) {
      await this.registry.remove(tenant.id).catch(() => undefined);
      throw error;
    }

    const members = await this.grantEveryone(tenant.id);
    await this.enableActivePlugins(tenant.id);
    await this.activateCurrentTheme(tenant.id);
    const unassigned = await this.unassigned();
    this.logger.warn(`Deployment adopted as tenant "${tenant.slug}" (${tenant.id}); ${members} members. RESTART REQUIRED for tenancy to take effect.`);
    return { tenant, stamped, members, unassigned, restartRequired: true };
  }

  /** Settings tables are copied (platform rows stay); everything else is stamped. */
  private async stamp(table: TenantTableDescriptor, tenantId: string): Promise<number> {
    if (table.name === SystemConstants.TABLE.META) {
      const columns = ['key', 'value', 'description', 'group'].filter((column) => table.hasColumn(column));
      const rows = await this.db.queryRaw(
        `INSERT INTO ${TenantSql.identifier(table.name)} (${TenantSql.identifiers([...columns, 'tenant_id'])}) `
        + `SELECT ${TenantSql.identifiers(columns)}, $1 FROM ${TenantSql.identifier(table.name)} `
        + `WHERE tenant_id IS NULL AND NOT (key = ANY($2)) RETURNING key`,
        [tenantId, TenantBespokePolicies.platformKeys()],
      );
      return rows.length;
    }
    if (table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) {
      const columns = table.columns.filter((column) => !['id', 'tenant_id'].includes(column));
      const rows = await this.db.queryRaw(
        `INSERT INTO ${TenantSql.identifier(table.name)} (${TenantSql.identifiers([...columns, 'tenant_id'])}) `
        + `SELECT ${TenantSql.identifiers(columns)}, $1 FROM ${TenantSql.identifier(table.name)} WHERE tenant_id IS NULL RETURNING plugin_slug`,
        [tenantId],
      );
      return rows.length;
    }
    const before = await this.db.queryRaw(TenantRlsSql.unassignedCountStatement(table.name));
    await this.db.queryRaw(TenantRlsSql.backfillStatement(table.name), [tenantId]);
    return Number(before[0]?.unassigned ?? 0);
  }

  private async grantEveryone(tenantId: string): Promise<number> {
    const memberships = new TenantMembershipService(this.db);
    const users = await this.db.queryRaw(`SELECT id, roles FROM ${TenantSql.identifier(SystemConstants.TABLE.USERS)} ORDER BY id`);
    const extra = await this.usersRoles();
    for (const user of users) {
      const id = CoercionUtils.toString(user.id);
      const roles = [...new Set([...TenantArchiveUsersExport.roles(user.roles), ...(extra.get(id) ?? [])])];
      await memberships.grant(id, tenantId, roles);
    }
    return users.length;
  }

  private async usersRoles(): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!(await this.db.tableExists(SystemConstants.TABLE.USERS_ROLES))) return out;
    for (const row of await this.db.queryRaw(`SELECT user_id, role_slug FROM ${TenantSql.identifier(SystemConstants.TABLE.USERS_ROLES)}`)) {
      const id = CoercionUtils.toString(row.user_id);
      out.set(id, [...(out.get(id) ?? []), CoercionUtils.toString(row.role_slug)]);
    }
    return out;
  }

  private async enableActivePlugins(tenantId: string): Promise<void> {
    await this.db.queryRaw(
      `INSERT INTO ${TenantSql.identifier(SystemConstants.TABLE.TENANT_PLUGINS)} (tenant_id, plugin_slug, state, enabled_at) `
      + `SELECT $1, slug, 'active', CURRENT_TIMESTAMP FROM ${TenantSql.identifier(SystemConstants.TABLE.PLUGINS)} WHERE state = 'active' ON CONFLICT DO NOTHING`,
      [tenantId],
    );
  }

  private async activateCurrentTheme(tenantId: string): Promise<void> {
    if (!(await this.db.tableExists(SystemConstants.TABLE.THEMES))) return;
    await this.db.queryRaw(
      `INSERT INTO ${TenantSql.identifier(SystemConstants.TABLE.TENANT_THEMES)} (tenant_id, theme_slug, state, config) `
      + `SELECT $1, slug, 'active', config FROM ${TenantSql.identifier(SystemConstants.TABLE.THEMES)} WHERE state = 'active' ON CONFLICT DO NOTHING`,
      [tenantId],
    );
  }

  /** Rows still without an owner after adoption — must be zero everywhere before the restart. */
  private async unassigned(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const table of this.tables) {
      if (!table.hasTenantColumn) continue;
      if (table.name === SystemConstants.TABLE.META || table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) continue;
      const rows = await this.db.queryRaw(TenantRlsSql.unassignedCountStatement(table.name));
      const count = Number(rows[0]?.unassigned ?? 0);
      if (count > 0) out[table.name] = count;
    }
    return out;
  }
}
