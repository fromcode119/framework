import { randomBytes } from 'crypto';
import { getTableName } from 'drizzle-orm';
import { IDatabaseManager, Schema } from '@fromcode119/database';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, Logger, PluginState, StringUtils, PlatformOwnershipService, PlatformOwnershipError, PluginTenantAccess, RequestContextUtils, TenantMode, TenantMembershipService } from '@fromcode119/core';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { SystemConstants } from '@fromcode119/core';
import { RoleManagementService } from '@api/services/role-management-service';

// Physical table names for the composite-key junction tables. Writes go through the string-table
// path (which maps camelCase → snake_case columns); the drizzle schema-object write path does not
// apply that mapping for these keyless junction tables, producing "no such column: userId".

export class UserManagementService {
  private static readonly USERS_ROLES_TABLE = getTableName(Schema.systemUsersToRoles);
  private static readonly USERS_TABLE = getTableName(Schema.users);

  private logger = new Logger({ namespace: 'UserManagement' });

  private readonly roles: RoleManagementService;

  constructor(
    private db: IDatabaseManager, 
    private auth: AuthManager,
    private manager: PluginManager
  ) {
    this.roles = new RoleManagementService(db);
  }

  private mergeRoles(columnRoles: any, rbacRoles: string[]): string[] {
    let col: string[] = [];
    try {
      col = Array.isArray(columnRoles)
        ? columnRoles.map((r: any) => String(r ?? '').trim().toLowerCase()).filter(Boolean)
        : typeof columnRoles === 'string'
          ? (columnRoles.startsWith('[') ? JSON.parse(columnRoles) : columnRoles.split(',').map((r: string) => r.trim()).filter(Boolean))
          : [];
    } catch { col = []; }
    return [...new Set([...col, ...rbacRoles])];
  }

  /**
   * `ids` restricts the listing to those accounts — the caller's site's members. `null` is
   * unrestricted (platform admin, or a single-tenant deployment); an EMPTY array is a real answer and
   * returns nothing, so a request acting for no site cannot fall through to everyone.
   */
  async getUsers(ids: number[] | null = null) {
    if (Array.isArray(ids) && ids.length === 0) return [];
    const allUsers = await this.db.find(Schema.users, ids
      ? { where: this.db.inArray(Schema.users.id, ids) }
      : undefined);
    return Promise.all(allUsers.map(async (user: any) => {
      const userRoles = await this.db.find(Schema.systemUsersToRoles, {
        columns: { roleSlug: true },
        where: this.db.eq(Schema.systemUsersToRoles.userId, user.id)
      });
      // `password` for the obvious reason, and `isPlatformAdmin` because this listing is reachable by a
      // site's own administrator: whether one of its members also holds platform powers identifies the
      // operator's staff account among that site's people, and nothing on this screen needs it. The
      // column is declared in the schema so typed callers can read it deliberately — this projection
      // spreads whatever the row carries, so a column added there would otherwise appear here by
      // accident rather than by decision, which is how it first turned up.
      const { password, isPlatformAdmin, ...safeUser } = user;
      void isPlatformAdmin;
      const [accountStatus, forcePasswordReset] = await Promise.all([
        this.readAccountStatus(user.id),
        this.readForcePasswordReset(user.id)
      ]);
      return {
        ...safeUser,
        roles: this.mergeRoles(safeUser.roles, userRoles.map((r: any) => r.roleSlug)),
        accountStatus: String(accountStatus.value),
        forcePasswordReset
      };
    }));
  }

  async getUser(id: number) {
    const user = await this.db.findOne(Schema.users, { id });
    if (!user) return null;
    
    const userRoles = await this.db.find(Schema.systemUsersToRoles, {
      columns: { roleSlug: true },
      where: this.db.eq(Schema.systemUsersToRoles.userId, user.id)
    });
    const { password, ...safeUser } = user;
    const [accountStatus, forcePasswordReset] = await Promise.all([
      this.readAccountStatus(user.id),
      this.readForcePasswordReset(user.id)
    ]);
    return {
      ...safeUser,
      roles: this.mergeRoles(safeUser.roles, userRoles.map((r: any) => r.roleSlug)),
      accountStatus: String(accountStatus.value),
      forcePasswordReset
    };
  }

  async saveUser(id: number | null, data: any) {
    const now = new Date();
    const updateData: any = {
      email: data.email,
      username: data.username ?? null,
      firstName: data.firstName,
      lastName: data.lastName,
      updatedAt: now,
    };

    if (data.password) {
      updateData.password = await this.auth.hashPassword(data.password);
    }

    let userId = id;
    if (userId) {
      await this.db.update(Schema.users, { id: userId }, updateData);
    } else {
      const initialPassword = data.password || randomBytes(24).toString('hex');
      const newUser = await this.db.insert(Schema.users, {
          email: data.email,
          username: data.username ?? null,
          password: await this.auth.hashPassword(initialPassword),
          firstName: data.firstName,
          lastName: data.lastName,
          createdAt: now,
          updatedAt: now,
        });
      userId = newUser.id;
    }

    // `undefined` means "not being changed"; anything else is an operator's choice, resolved by the
    // enum rather than compared to a literal here.
    if (data.accountStatus !== undefined) {
      await this.upsertMeta(`user:${userId}:account_status`, String(AccountStatus.resolve(data.accountStatus).value));
    } else if (!id) {
      await this.upsertMeta(`user:${userId}:account_status`, String(AccountStatus.ACTIVE.value));
    }
    if (typeof data.forcePasswordReset === 'boolean') {
      await this.upsertMeta(`user:${userId}:force_password_reset`, data.forcePasswordReset ? 'true' : 'false');
    } else if (!id) {
      await this.upsertMeta(`user:${userId}:force_password_reset`, 'false');
    }

    if (Array.isArray(data.roles)) {
      await this.db.delete(UserManagementService.USERS_ROLES_TABLE, { userId });
      if (data.roles.length > 0) {
        for (const roleSlug of data.roles) {
          await this.db.insert(UserManagementService.USERS_ROLES_TABLE, { userId, roleSlug });
        }
      }
    }
    return userId;
  }

  /** @see RoleManagementService.getRoles */
  getRoles(...args: Parameters<RoleManagementService["getRoles"]>): ReturnType<RoleManagementService["getRoles"]> {
    return this.roles.getRoles(...args);
  }

  /** @see RoleManagementService.saveRole */
  saveRole(...args: Parameters<RoleManagementService["saveRole"]>): ReturnType<RoleManagementService["saveRole"]> {
    return this.roles.saveRole(...args);
  }

  /** @see RoleManagementService.getRole */
  getRole(...args: Parameters<RoleManagementService["getRole"]>): ReturnType<RoleManagementService["getRole"]> {
    return this.roles.getRole(...args);
  }

  /** @see RoleManagementService.deleteRole */
  deleteRole(...args: Parameters<RoleManagementService["deleteRole"]>): ReturnType<RoleManagementService["deleteRole"]> {
    return this.roles.deleteRole(...args);
  }

  /** @see RoleManagementService.savePermission */
  savePermission(...args: Parameters<RoleManagementService["savePermission"]>): ReturnType<RoleManagementService["savePermission"]> {
    return this.roles.savePermission(...args);
  }

  async deleteUser(id: number) {
    // The owner seat is the one account that cannot be removed: it grants every tenant and gates plugin
    // installation, so deleting it would leave the platform with no one able to administer it and no way
    // to appoint anyone. Ownership is not stuck on that account either — it can be transferred, and the
    // previous owner becomes an ordinary admin who CAN then be deleted.
    if (await new PlatformOwnershipService(this.db).isOwner(id)) {
      // 409, not 403: the caller may well have every permission — the account is protected by the
      // state it is in, and transferring the seat is what resolves it.
      throw new PlatformOwnershipError(409, 'The platform owner cannot be deleted. Transfer ownership first, then delete the account.');
    }

    // Unlink any unified `people` row from this user BEFORE deleting it, so the person record does not
    // dangle on a now-deleted user id. A stale link is what blocks recreating the same person/partner
    // later (the new affiliate re-matches the old person, which still points at the deleted account) and
    // makes the old identity stick. The person is kept as a contact; only the account link is cleared.
    await this.db.update(SystemConstants.TABLE.PEOPLE, { userId: id }, { userId: null }).catch(() => undefined);
    await this.db.delete(Schema.users, { id });
    return true;
  }

  async saveUserRoles(userId: number, roles: string[]) {
    const normalized = StringUtils.normalizeSlugList(roles);

    await this.db.delete(UserManagementService.USERS_ROLES_TABLE, { userId });
    for (const roleSlug of normalized) {
      await this.db.insert(UserManagementService.USERS_ROLES_TABLE, { userId, roleSlug });
    }

    // Runtime authorization (UserPermissionChecker) reads a user's roles from the `users.roles` JSON
    // column — NOT the junction table written above. Keep the column in sync so an assigned role
    // actually grants its permissions; otherwise "Manage Roles" is a silent no-op for access control.
    // Use the STRING table path: it is json-column-aware and stringifies the array exactly ONCE. The
    // schema-object path double-encodes jsonb (normalizer stringifies, then drizzle `.set()` again).
    await this.db.update(UserManagementService.USERS_TABLE, { id: userId }, { roles: normalized, updatedAt: new Date() });
  }

  async getPermissions() {
    const plugins = this.manager.getPlugins().filter(p => p.state === PluginState.ACTIVE);
    const dbPermissions = await this.db.find(SystemConstants.TABLE.PERMISSIONS);
    const permissionNames = new Set(dbPermissions.map((permission: any) => String(permission?.name || '').trim()).filter(Boolean));
    
    for (const p of plugins) {
      const manifest = p?.manifest || {};
      const pluginSlug = String(manifest.slug || 'system').trim() || 'system';
      const pluginName = String(manifest.name || pluginSlug).trim() || 'Plugin';
      const pluginGroup = String(manifest.admin?.group || 'Other').trim() || 'Other';
      const caps: any[] = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
      for (const cap of caps) {
        const name = String(typeof cap === 'string' ? cap : cap?.name || '').trim();
        if (!name || permissionNames.has(name)) {
          continue;
        }

        const now = new Date();
        const description = typeof cap === 'string' ? `Capability from ${pluginName}` : String(cap?.description || `Capability from ${pluginName}`).trim();
        await this.savePermission({
          name,
          description,
          pluginSlug,
          group: pluginGroup,
          impact: 'Medium',
          updatedAt: now,
        });
        permissionNames.add(name);
      }
    }

    // THE BACKFILL ABOVE STAYS COMPLETE; THE ANSWER IS SCOPED.
    //
    // `_system_permissions` is a platform registry — every active plugin's capabilities are recorded
    // in it whoever happens to trigger this read, because a capability that is registered only when a
    // platform admin visits a screen is a capability that half the installs never get. What must not
    // happen is returning the whole registry to a site: it named products that site does not run
    // — capability names carry the extension's own vocabulary, so through the names themselves, what those
    // products do.
    //
    // `system` survives the filter because it is the framework's own, and every site holds it.
    const rows = await this.db.find(SystemConstants.TABLE.PERMISSIONS);
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!TenantMode.isEnabled() || !tenantId) return rows;

    const visible = PluginTenantAccess.enabledSlugsFor(tenantId);
    // Rows come back from the raw manager, so the column is `plugin_slug`.
    return (rows || []).filter((row: any) => {
      const slug = String(row?.plugin_slug ?? '').trim();
      return !slug || slug === 'system' || visible.has(slug);
    });
  }

  /**
   * The stored account status, as the ENUM the auth controllers already write and compare.
   *
   * This used to be an inline `'active' | 'suspended'` with its own defaulting, which is
   * `AccountStatus.resolve` spelled out a second time — for the same meta key the auth chain reads.
   * Two copies of "what does an unreadable value mean" is one copy too many when the answer decides
   * whether somebody may sign in.
   */
  private async readAccountStatus(userId: number): Promise<AccountStatus> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:account_status` });
    return AccountStatus.resolve(row?.value);
  }

  private async readForcePasswordReset(userId: number): Promise<boolean> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:force_password_reset` });
    return String(row?.value || '').trim().toLowerCase() === 'true';
  }

  private async upsertMeta(key: string, value: string) {
    const now = new Date();
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value, updatedAt: now });
      return;
    }
    await this.db.insert(SystemConstants.TABLE.META, { key, value, updatedAt: now });
  }
}
