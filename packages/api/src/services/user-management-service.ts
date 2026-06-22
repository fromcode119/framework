import { randomBytes } from 'crypto';
import { getTableName } from 'drizzle-orm';
import { IDatabaseManager, users, systemRoles, systemUsersToRoles, systemRolesToPermissions } from '@fromcode119/database';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, Logger } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';

// Physical table names for the composite-key junction tables. Writes go through the string-table
// path (which maps camelCase → snake_case columns); the drizzle schema-object write path does not
// apply that mapping for these keyless junction tables, producing "no such column: userId".
const USERS_ROLES_TABLE = getTableName(systemUsersToRoles);
const ROLES_PERMISSIONS_TABLE = getTableName(systemRolesToPermissions);
const USERS_TABLE = getTableName(users);

export class UserManagementService {
  private logger = new Logger({ namespace: 'UserManagement' });

  constructor(
    private db: IDatabaseManager, 
    private auth: AuthManager,
    private manager: PluginManager
  ) {}

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

  async getUsers() {
    const allUsers = await this.db.find(users);
    return Promise.all(allUsers.map(async (user: any) => {
      const userRoles = await this.db.find(systemUsersToRoles, {
        columns: { roleSlug: true },
        where: this.db.eq(systemUsersToRoles.userId, user.id)
      });
      const { password, ...safeUser } = user;
      const [accountStatus, forcePasswordReset] = await Promise.all([
        this.readAccountStatus(user.id),
        this.readForcePasswordReset(user.id)
      ]);
      return {
        ...safeUser,
        roles: this.mergeRoles(safeUser.roles, userRoles.map((r: any) => r.roleSlug)),
        accountStatus,
        forcePasswordReset
      };
    }));
  }

  async getUser(id: number) {
    const user = await this.db.findOne(users, { id });
    if (!user) return null;
    
    const userRoles = await this.db.find(systemUsersToRoles, {
      columns: { roleSlug: true },
      where: this.db.eq(systemUsersToRoles.userId, user.id)
    });
    const { password, ...safeUser } = user;
    const [accountStatus, forcePasswordReset] = await Promise.all([
      this.readAccountStatus(user.id),
      this.readForcePasswordReset(user.id)
    ]);
    return {
      ...safeUser,
      roles: this.mergeRoles(safeUser.roles, userRoles.map((r: any) => r.roleSlug)),
      accountStatus,
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
      await this.db.update(users, { id: userId }, updateData);
    } else {
      const initialPassword = data.password || randomBytes(24).toString('hex');
      const newUser = await this.db.insert(users, {
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

    if (typeof data.accountStatus === 'string') {
      const status = String(data.accountStatus).trim().toLowerCase() === 'suspended' ? 'suspended' : 'active';
      await this.upsertMeta(`user:${userId}:account_status`, status);
    } else if (!id) {
      await this.upsertMeta(`user:${userId}:account_status`, 'active');
    }
    if (typeof data.forcePasswordReset === 'boolean') {
      await this.upsertMeta(`user:${userId}:force_password_reset`, data.forcePasswordReset ? 'true' : 'false');
    } else if (!id) {
      await this.upsertMeta(`user:${userId}:force_password_reset`, 'false');
    }

    if (Array.isArray(data.roles)) {
      await this.db.delete(USERS_ROLES_TABLE, { userId });
      if (data.roles.length > 0) {
        for (const roleSlug of data.roles) {
          await this.db.insert(USERS_ROLES_TABLE, { userId, roleSlug });
        }
      }
    }
    return userId;
  }

  async getRoles() {
    const dbRoles = await this.db.find(systemRoles);
    return Promise.all(dbRoles.map(async (role: any) => {
      const userCount = await this.db.count(systemUsersToRoles, {
        where: this.db.eq(systemUsersToRoles.roleSlug, role.slug)
      });
      const permsResult = await this.db.find(systemRolesToPermissions, {
        columns: { permissionName: true },
        where: this.db.eq(systemRolesToPermissions.roleSlug, role.slug)
      });
      return { ...role, permissions: permsResult.map((r: any) => r.permissionName), users: userCount };
    }));
  }

  async saveRole(slug: string, data: any) {
    const now = new Date();
    await this.db.upsert(systemRoles, {
      slug,
      name: data.name,
      description: data.description,
      type: data.type || 'custom',
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      // Provide timestamps explicitly: drizzle would otherwise emit the pg `.defaultNow()` (`now()`)
      // for these omitted columns, which the SQLite runtime rejects ("no such function: now").
      createdAt: now,
      updatedAt: now,
    }, {
      target: 'slug',
      set: {
        name: data.name,
        description: data.description,
        type: data.type || 'custom',
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        updatedAt: now
      }
    });

    if (Array.isArray(data.permissions)) {
      await this.db.delete(ROLES_PERMISSIONS_TABLE, { roleSlug: slug });
      if (data.permissions.length > 0) {
        for (const perm of data.permissions) {
          await this.db.insert(ROLES_PERMISSIONS_TABLE, { roleSlug: slug, permissionName: perm });
        }
      }
    }
  }

  async getRole(slug: string) {
    const role = await this.db.findOne(systemRoles, { slug });
    if (!role) return null;

    const userCount = await this.db.count(systemUsersToRoles, {
      where: this.db.eq(systemUsersToRoles.roleSlug, role.slug)
    });
    const permsResult = await this.db.find(systemRolesToPermissions, {
      columns: { permissionName: true },
      where: this.db.eq(systemRolesToPermissions.roleSlug, role.slug)
    });

    return {
      ...role,
      permissions: permsResult.map((r: any) => r.permissionName),
      users: userCount
    };
  }

  async deleteRole(slug: string) {
    await this.db.delete(systemRoles, { slug });
    return true;
  }

  async savePermission(data: any) {
    if (!data?.name) {
      throw new Error('Permission name is required');
    }

    const now = new Date();
    const existing = await this.db.findOne(SystemConstants.TABLE.PERMISSIONS, { name: data.name });
    const payload = {
      name: data.name,
      description: data.description || null,
      pluginSlug: data.pluginSlug || 'system',
      group: data.group || 'Other',
      impact: data.impact || 'Medium',
      updatedAt: now
    };

    if (existing) {
      await this.db.update(SystemConstants.TABLE.PERMISSIONS, { name: data.name }, payload);
      return;
    }

    try {
      await this.db.insert(SystemConstants.TABLE.PERMISSIONS, {
        ...payload,
        createdAt: now
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      if (!message.includes('UNIQUE constraint failed') && !message.toLowerCase().includes('duplicate')) {
        throw error;
      }

      await this.db.update(SystemConstants.TABLE.PERMISSIONS, { name: data.name }, payload);
    }
  }

  async deleteUser(id: number) {
    await this.db.delete(users, { id });
    return true;
  }

  async saveUserRoles(userId: number, roles: string[]) {
    const normalized = [...new Set(
      (Array.isArray(roles) ? roles : []).map((r) => String(r ?? '').trim().toLowerCase()).filter(Boolean),
    )];

    await this.db.delete(USERS_ROLES_TABLE, { userId });
    for (const roleSlug of normalized) {
      await this.db.insert(USERS_ROLES_TABLE, { userId, roleSlug });
    }

    // Runtime authorization (UserPermissionChecker) reads a user's roles from the `users.roles` JSON
    // column — NOT the junction table written above. Keep the column in sync so an assigned role
    // actually grants its permissions; otherwise "Manage Roles" is a silent no-op for access control.
    // Use the STRING table path: it is json-column-aware and stringifies the array exactly ONCE. The
    // schema-object path double-encodes jsonb (normalizer stringifies, then drizzle `.set()` again).
    await this.db.update(USERS_TABLE, { id: userId }, { roles: normalized, updatedAt: new Date() });
  }

  async getPermissions() {
    const plugins = this.manager.getPlugins().filter(p => p.state === 'active');
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
    return this.db.find(SystemConstants.TABLE.PERMISSIONS);
  }

  private async readAccountStatus(userId: number): Promise<'active' | 'suspended'> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:account_status` });
    const value = String(row?.value || '').trim().toLowerCase();
    return value === 'suspended' ? 'suspended' : 'active';
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
