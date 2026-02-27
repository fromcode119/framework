import { 
  IDatabaseManager, users, systemRoles, systemUsersToRoles, 
  systemRolesToPermissions
} from '@fromcode119/database';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, Logger, SystemTable } from '@fromcode119/core';

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
    const updateData: any = {
      email: data.email,
      username: data.username ?? null,
      firstName: data.firstName,
      lastName: data.lastName,
      updatedAt: new Date()
    };

    if (data.password) {
      updateData.password = await this.auth.hashPassword(data.password);
    }

    let userId = id;
    if (userId) {
      await this.db.update(users, { id: userId }, updateData);
    } else {
      const newUser = await this.db.insert(users, {
          email: data.email,
          password: await this.auth.hashPassword(data.password || 'change-me-123'),
          firstName: data.firstName,
          lastName: data.lastName
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
      await this.db.delete(systemUsersToRoles, this.db.eq(systemUsersToRoles.userId, userId as any));
      if (data.roles.length > 0) {
        for (const roleSlug of data.roles) {
          await this.db.insert(systemUsersToRoles, { userId, roleSlug });
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
    await this.db.upsert(systemRoles, {
      slug,
      name: data.name,
      description: data.description,
      type: data.type || 'custom',
      permissions: Array.isArray(data.permissions) ? data.permissions : []
    }, {
      target: 'slug',
      set: {
        name: data.name,
        description: data.description,
        type: data.type || 'custom',
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        updatedAt: new Date()
      }
    });

    if (Array.isArray(data.permissions)) {
      await this.db.delete(systemRolesToPermissions, this.db.eq(systemRolesToPermissions.roleSlug, slug));
      if (data.permissions.length > 0) {
        for (const perm of data.permissions) {
          await this.db.insert(systemRolesToPermissions, { roleSlug: slug, permissionName: perm });
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
    const existing = await this.db.findOne(SystemTable.PERMISSIONS, { name: data.name });
    const payload = {
      name: data.name,
      description: data.description || null,
      pluginSlug: data.pluginSlug || 'system',
      group: data.group || 'Other',
      impact: data.impact || 'Medium',
      updatedAt: now
    };

    if (existing) {
      await this.db.update(SystemTable.PERMISSIONS, { name: data.name }, payload);
      return;
    }

    await this.db.insert(SystemTable.PERMISSIONS, {
      ...payload,
      createdAt: now
    });
  }

  async deleteUser(id: number) {
    await this.db.delete(users, { id });
    return true;
  }

  async saveUserRoles(userId: number, roles: string[]) {
    await this.db.delete(systemUsersToRoles, { userId });
    if (roles.length > 0) {
      for (const roleSlug of roles) {
        await this.db.insert(systemUsersToRoles, { userId, roleSlug });
      }
    }
  }

  async getPermissions() {
    const plugins = this.manager.getPlugins().filter(p => p.state === 'active');
    const dbPermissions = await this.db.find(SystemTable.PERMISSIONS);
    
    for (const p of plugins) {
      const caps: any[] = Array.isArray(p.manifest.capabilities) ? p.manifest.capabilities : [];
      for (const cap of caps) {
        const name = typeof cap === 'string' ? cap : cap.name;
        if (!dbPermissions.find((d: any) => d.name === name)) {
          const now = new Date();
          const perm = {
            name,
            description: typeof cap === 'string' ? `Capability from ${p.manifest.name}` : cap.description,
            pluginSlug: p.manifest.slug,
            group: p.manifest.admin?.group || 'Other',
            impact: 'Medium',
            createdAt: now,
            updatedAt: now
          };
          await this.db.insert(SystemTable.PERMISSIONS, perm);
        }
      }
    }
    return this.db.find(SystemTable.PERMISSIONS);
  }

  private async readAccountStatus(userId: number): Promise<'active' | 'suspended'> {
    const row = await this.db.findOne(SystemTable.META, { key: `user:${userId}:account_status` });
    const value = String(row?.value || '').trim().toLowerCase();
    return value === 'suspended' ? 'suspended' : 'active';
  }

  private async readForcePasswordReset(userId: number): Promise<boolean> {
    const row = await this.db.findOne(SystemTable.META, { key: `user:${userId}:force_password_reset` });
    return String(row?.value || '').trim().toLowerCase() === 'true';
  }

  private async upsertMeta(key: string, value: string) {
    const existing = await this.db.findOne(SystemTable.META, { key });
    if (existing) {
      await this.db.update(SystemTable.META, { key }, { value });
      return;
    }
    await this.db.insert(SystemTable.META, { key, value });
  }
}
