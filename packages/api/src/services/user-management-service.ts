import { 
  IDatabaseManager, eq, count, users, systemRoles, systemUsersToRoles, 
  systemRolesToPermissions, systemPermissions 
} from '@fromcode/database';
import { AuthManager } from '@fromcode/auth';
import { PluginManager, Logger } from '@fromcode/core';

export class UserManagementService {
  private logger = new Logger({ namespace: 'UserManagement' });
  private drizzle: any;

  constructor(
    private db: IDatabaseManager, 
    private auth: AuthManager,
    private manager: PluginManager
  ) {
    this.drizzle = (db as any).drizzle;
  }

  async getUsers() {
    const allUsers = await this.db.find(users);
    return Promise.all(allUsers.map(async (user: any) => {
      const userRoles = await this.drizzle
        .select({ roleSlug: systemUsersToRoles.roleSlug })
        .from(systemUsersToRoles)
        .where(eq(systemUsersToRoles.userId, user.id));
      const { password, ...safeUser } = user;
      return { ...safeUser, roles: userRoles.map((r: any) => r.roleSlug) };
    }));
  }

  async getUser(id: number) {
    const user = await this.db.findOne(users, { id });
    if (!user) return null;
    
    const userRoles = await this.drizzle
      .select({ roleSlug: systemUsersToRoles.roleSlug })
      .from(systemUsersToRoles)
      .where(eq(systemUsersToRoles.userId, user.id));
    const { password, ...safeUser } = user;
    return { ...safeUser, roles: userRoles.map((r: any) => r.roleSlug) };
  }

  async saveUser(id: number | null, data: any) {
    const updateData: any = {
      email: data.email,
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

    if (Array.isArray(data.roles)) {
      await this.db.delete(systemUsersToRoles, eq(systemUsersToRoles.userId, userId as any));
      if (data.roles.length > 0) {
        await this.drizzle.insert(systemUsersToRoles).values(
          data.roles.map((r: string) => ({ userId, roleSlug: r }))
        );
      }
    }
    return userId;
  }

  async getRoles() {
    const dbRoles = await this.db.find(systemRoles);
    return Promise.all(dbRoles.map(async (role: any) => {
      const userCountResult = await this.drizzle.select({ value: count() }).from(systemUsersToRoles).where(eq(systemUsersToRoles.roleSlug, role.slug));
      const permsResult = await this.drizzle.select({ name: systemRolesToPermissions.permissionName }).from(systemRolesToPermissions).where(eq(systemRolesToPermissions.roleSlug, role.slug));
      return { ...role, permissions: permsResult.map((r: any) => r.name), users: Number(userCountResult[0].value) };
    }));
  }

  async saveRole(slug: string, data: any) {
    await this.drizzle.insert(systemRoles)
      .values({
        slug,
        name: data.name,
        description: data.description,
        type: data.type || 'custom',
        permissions: Array.isArray(data.permissions) ? data.permissions : []
      })
      .onConflictDoUpdate({
        target: systemRoles.slug,
        set: {
          name: data.name,
          description: data.description,
          type: data.type || 'custom',
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          updatedAt: new Date()
        }
      });

    if (Array.isArray(data.permissions)) {
      await this.db.delete(systemRolesToPermissions, eq(systemRolesToPermissions.roleSlug, slug));
      if (data.permissions.length > 0) {
        await this.drizzle.insert(systemRolesToPermissions).values(
          data.permissions.map((perm: string) => ({ roleSlug: slug, permissionName: perm }))
        ).onConflictDoNothing();
      }
    }
  }

  async getRole(slug: string) {
    const role = await this.db.findOne(systemRoles, { slug });
    if (!role) return null;

    const userCountResult = await this.drizzle
      .select({ value: count() })
      .from(systemUsersToRoles)
      .where(eq(systemUsersToRoles.roleSlug, role.slug));
    const permsResult = await this.drizzle
      .select({ name: systemRolesToPermissions.permissionName })
      .from(systemRolesToPermissions)
      .where(eq(systemRolesToPermissions.roleSlug, role.slug));

    return {
      ...role,
      permissions: permsResult.map((r: any) => r.name),
      users: Number(userCountResult[0]?.value || 0)
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

    const existing = await this.db.findOne(systemPermissions, { name: data.name });
    const payload = {
      name: data.name,
      description: data.description || null,
      pluginSlug: data.pluginSlug || 'system',
      group: data.group || 'Other',
      impact: data.impact || 'Medium',
      updatedAt: new Date()
    };

    if (existing) {
      await this.db.update(systemPermissions, { name: data.name }, payload);
      return;
    }

    await this.db.insert(systemPermissions, payload);
  }

  async deleteUser(id: number) {
    await this.db.delete(users, { id });
    return true;
  }

  async saveUserRoles(userId: number, roles: string[]) {
    await this.db.delete(systemUsersToRoles, { userId });
    if (roles.length > 0) {
      await this.drizzle.insert(systemUsersToRoles).values(
        roles.map((roleSlug) => ({ userId, roleSlug }))
      );
    }
  }

  async getPermissions() {
    const plugins = this.manager.getPlugins().filter(p => p.state === 'active');
    const dbPermissions = await this.db.find(systemPermissions);
    
    for (const p of plugins) {
      const caps: any[] = Array.isArray(p.manifest.capabilities) ? p.manifest.capabilities : [];
      for (const cap of caps) {
        const name = typeof cap === 'string' ? cap : cap.name;
        if (!dbPermissions.find((d: any) => d.name === name)) {
          const perm = {
            name,
            description: typeof cap === 'string' ? `Capability from ${p.manifest.name}` : cap.description,
            pluginSlug: p.manifest.slug,
            group: p.manifest.admin?.group || 'Other',
            impact: 'Medium'
          };
          await this.db.insert(systemPermissions, perm);
        }
      }
    }
    return this.db.find(systemPermissions);
  }
}
