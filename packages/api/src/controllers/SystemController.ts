import { Request, Response } from 'express';
import { PluginManager, ThemeManager } from '@fromcode/core';
import { 
  count, sql, systemLogs, systemRoles, users, desc, eq, or, ilike,
  systemUsersToRoles, systemRolesToPermissions, systemPermissions 
} from '@fromcode/database';
import { SystemUpdateService } from '@fromcode/core';
import { RESTController } from '../rest-controller';

export class SystemController {
  private db: any;

  constructor(private manager: PluginManager, private themeManager: ThemeManager, private restController: RESTController) {
    this.db = (manager as any).db.drizzle;
  }

  async getAdminMetadata(req: Request, res: Response) {
    res.json(this.manager.getAdminMetadata());
  }

  async getFrontendMetadata(req: Request, res: Response) {
    res.json(this.themeManager.getFrontendMetadata());
  }

  async getStats(req: Request, res: Response) {
    const collections = this.manager.getCollections();
    const stats = await Promise.all(collections.map(async (c) => {
      try {
        const total = await (this.manager as any).db.count(c.tableName || c.slug);
        return {
          slug: c.slug,
          name: c.name || c.slug,
          count: total,
          system: !!(c as any).system,
          priority: (c as any).priority || 100
        };
      } catch (e) {
        return { slug: c.slug, count: 0, error: true };
      }
    }));
    res.json(stats);
  }

  async getActivity(req: Request, res: Response) {
    const collections = this.manager.getCollections();
    await this.restController.getGlobalActivity(collections, req, res);
  }

  async getLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string || '');
      const offset = (page - 1) * limit;

      let whereClause = undefined;
      if (search) {
        whereClause = or(
          ilike(systemLogs.message, `%${search}%`),
          ilike(systemLogs.pluginSlug, `%${search}%`)
        );
      }

      const totalResult = await this.db.select({ value: count() })
        .from(systemLogs)
        .where(whereClause);
      const totalDocs = Number(totalResult[0]?.value || 0);

      const logs = await this.db.select()
        .from(systemLogs)
        .where(whereClause)
        .orderBy(desc(systemLogs.timestamp))
        .limit(limit)
        .offset(offset);

      res.json({
        docs: logs,
        totalDocs,
        limit,
        page,
        totalPages: Math.ceil(totalDocs / limit)
      });
    } catch (err) {
      console.error('[SystemController] Log Fetch Error:', err);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }

  async getRoles(req: Request, res: Response) {
    try {
      // Fetch real roles from the database
      const dbRoles = await this.db.select().from(systemRoles);
      
      // Enhance roles with user counts using proper bridge tables
      const enhancedRoles = await Promise.all(dbRoles.map(async (role: any) => {
        // Count users from the bridge table using Drizzle
        const userCountResult = await this.db
          .select({ value: count() })
          .from(systemUsersToRoles)
          .where(eq(systemUsersToRoles.roleSlug, role.slug));
        
        // Fetch permissions from the bridge table using Drizzle
        const permsResult = await this.db
          .select({ name: systemRolesToPermissions.permissionName })
          .from(systemRolesToPermissions)
          .where(eq(systemRolesToPermissions.roleSlug, role.slug));
        
        const perms = permsResult.map((r: any) => r.name);

        return {
          ...role,
          permissions: perms,
          users: Number(userCountResult[0].value)
        };
      }));

      res.json(enhancedRoles);
    } catch (err: any) {
      console.error('[SystemController] Failed to fetch roles:', err);
      res.status(500).json({ error: 'Failed to fetch roles: ' + err.message });
    }
  }

  async getRole(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const role = await this.db.select().from(systemRoles).where(eq(systemRoles.slug, slug)).limit(1);
      
      if (!role[0]) {
        return res.status(404).json({ error: 'Role not found' });
      }

      // Fetch users count
      const userCountResult = await this.db
        .select({ value: count() })
        .from(systemUsersToRoles)
        .where(eq(systemUsersToRoles.roleSlug, slug));
      
      // Fetch permissions
      const permsResult = await this.db
        .select({ name: systemRolesToPermissions.permissionName })
        .from(systemRolesToPermissions)
        .where(eq(systemRolesToPermissions.roleSlug, slug));
      
      const perms = permsResult.map((r: any) => r.name);

      res.json({
        ...role[0],
        permissions: perms,
        users: Number(userCountResult[0].value)
      });
    } catch (err: any) {
      console.error('[SystemController] Failed to fetch role:', err);
      res.status(500).json({ error: 'Failed to fetch role: ' + err.message });
    }
  }

  async deleteRole(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      
      // Check if it's a system role
      const role = await this.db.select().from(systemRoles).where(eq(systemRoles.slug, slug)).limit(1);
      if (role[0]?.type === 'system') {
        return res.status(403).json({ error: 'System roles cannot be deleted' });
      }

      // Delete bridge associations first
      await this.db.delete(systemRolesToPermissions).where(eq(systemRolesToPermissions.roleSlug, slug));
      await this.db.delete(systemUsersToRoles).where(eq(systemUsersToRoles.roleSlug, slug));
      
      // Delete the role
      await this.db.delete(systemRoles).where(eq(systemRoles.slug, slug));
      
      res.json({ success: true });
    } catch (err: any) {
      console.error('[SystemController] Failed to delete role:', err);
      res.status(500).json({ error: 'Failed to delete role: ' + err.message });
    }
  }

  async saveRole(req: Request, res: Response) {
    try {
      const { name, description, type, permissions } = req.body;
      const slug = req.params.slug || req.body.slug;
      
      if (!slug || !name) return res.status(400).json({ error: 'Slug and Name are required' });

      // 1. Update/Insert into main table
      await this.db.insert(systemRoles)
        .values({
          slug,
          name,
          description,
          type: type || 'custom',
          permissions: Array.isArray(permissions) ? permissions : []
        })
        .onConflictDoUpdate({
          target: systemRoles.slug,
          set: {
            name,
            description,
            type: type || 'custom',
            permissions: Array.isArray(permissions) ? permissions : [],
            updatedAt: new Date()
          }
        });

      // 2. Sync Permissions Bridge Table
      if (Array.isArray(permissions)) {
        await this.db.delete(systemRolesToPermissions)
          .where(eq(systemRolesToPermissions.roleSlug, slug));
          
        if (permissions.length > 0) {
          const values = permissions.map(perm => ({
            roleSlug: slug,
            permissionName: perm
          }));
          
          await this.db.insert(systemRolesToPermissions)
            .values(values)
            .onConflictDoNothing();
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save role: ' + err.message });
    }
  }

  async getPermissions(req: Request, res: Response) {
    try {
      const plugins = this.manager.getPlugins().filter(p => p.state === 'active');
      const dbPermissions = await this.db.select().from(systemPermissions);
      const detectedPermissions: any[] = [];
      
      // Scan Plugins for Custom Capabilities
      plugins.forEach(p => {
        const caps = p.manifest.capabilities || [];
        caps.forEach((cap: any) => {
          const capName = typeof cap === 'string' ? cap : cap.name;
          
          // Only add as a plugin permission if it doesn't exist in DB already
          // This ensures core capabilities (seeded via migrations) are not clobbered
          if (!dbPermissions.some((c: any) => c.name === capName)) {
            detectedPermissions.push({
              name: capName,
              description: typeof cap === 'string' ? `Capability provided by plugin: ${p.manifest.name || p.manifest.slug}` : cap.description,
              pluginSlug: p.manifest.slug,
              group: p.manifest.admin?.group || 'Other',
              impact: 'Medium'
            });
          }
        });
      });

      // Sync detected plugin permissions to DB (upsert)
      if (detectedPermissions.length > 0) {
        for (const perm of detectedPermissions) {
          await this.db.insert(systemPermissions)
            .values(perm)
            .onConflictDoUpdate({
              target: systemPermissions.name,
              set: {
                description: perm.description,
                pluginSlug: perm.pluginSlug,
                group: perm.group,
                impact: perm.impact,
                updatedAt: new Date()
              }
            });
        }
        
        // Refetch to get the updated list
        return res.json(await this.db.select().from(systemPermissions));
      }

      res.json(dbPermissions);
    } catch (err: any) {
      console.error('[SystemController] Failed to fetch/sync permissions:', err);
      res.status(500).json({ error: 'Failed to fetch permissions: ' + err.message });
    }
  }

  async savePermission(req: Request, res: Response) {
    try {
      const { name, description, pluginSlug, group, impact } = req.body;
      if (!name) return res.status(400).json({ error: 'Permission Name is required' });

      const { systemPermissions } = await import('@fromcode/database');
      await this.db.insert(systemPermissions)
        .values({
          name,
          description,
          pluginSlug: pluginSlug || 'custom',
          group: group || 'Custom',
          impact: impact || 'Medium'
        })
        .onConflictDoUpdate({
          target: systemPermissions.name,
          set: {
            description,
            pluginSlug: pluginSlug || 'custom',
            group: group || 'Custom',
            impact: impact || 'Medium',
            updatedAt: new Date()
          }
        });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save permission: ' + err.message });
    }
  }

  async getI18n(req: Request, res: Response) {
    const locale = (req.query.locale as string) || 'en';
    const translations = (this.manager as any).i18n.translations;
    const localeMap = translations.get(locale) || translations.get('en') || {};
    const activeSlugs = new Set(this.manager.getPlugins().filter(p => p.state === 'active').map(p => p.manifest.slug));
    
    const filteredMap: any = {};
    for (const [slug, data] of Object.entries(localeMap)) {
      if (activeSlugs.has(slug)) filteredMap[slug] = data;
    }
    res.json(filteredMap);
  }

  async getUsers(req: Request, res: Response) {
    try {
      const allUsers = await this.db.select().from(users);
      
      const usersWithRoles = await Promise.all(allUsers.map(async (user: any) => {
        const userRoles = await this.db
          .select({ roleSlug: systemUsersToRoles.roleSlug })
          .from(systemUsersToRoles)
          .where(eq(systemUsersToRoles.userId, user.id));
        
        return {
          ...user,
          roles: userRoles.map((r: any) => r.roleSlug)
        };
      }));

      res.json({ docs: usersWithRoles });
    } catch (err: any) {
      console.error('[SystemController] getUsers Error:', err);
      res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await this.db.select().from(users).where(eq(users.id, parseInt(id))).limit(1);
      const user = result[0];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userRoles = await this.db
        .select({ roleSlug: systemUsersToRoles.roleSlug })
        .from(systemUsersToRoles)
        .where(eq(systemUsersToRoles.userId, user.id));

      const { password, ...safeUser } = user;
      res.json({
        ...safeUser,
        roles: userRoles.map((r: any) => r.roleSlug)
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch user: ' + err.message });
    }
  }

  async saveUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { email, password, firstName, lastName, roles } = req.body;
      
      const auth = (this.manager as any).auth;
      const updateData: any = {
        email,
        firstName,
        lastName,
        updatedAt: new Date()
      };

      if (password) {
        updateData.password = await auth.hashPassword(password);
      }

      let userId = id ? parseInt(id) : null;

      if (userId) {
        // Update existing
        await this.db.update(users)
          .set(updateData)
          .where(eq(users.id, userId));
      } else {
        // Create new
        const [newUser] = await this.db.insert(users)
          .values({
            email,
            password: await auth.hashPassword(password || 'change-me-123'),
            firstName,
            lastName
          })
          .returning();
        userId = newUser.id;
      }

      // Sync Roles
      if (Array.isArray(roles)) {
        await this.db.delete(systemUsersToRoles).where(eq(systemUsersToRoles.userId, userId));
        if (roles.length > 0) {
          await this.db.insert(systemUsersToRoles).values(
            roles.map(r => ({ userId, roleSlug: r }))
          );
        }
      }

      res.json({ success: true, id: userId });
    } catch (err: any) {
      console.error('[SystemController] saveUser Error:', err);
      res.status(500).json({ error: 'Failed to save user: ' + err.message });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const uId = parseInt(id);

      // Check if trying to delete self? (Should be handled by middleware or client)
      
      await this.db.delete(users).where(eq(users.id, uId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete user: ' + err.message });
    }
  }

  async saveUserRoles(req: Request, res: Response) {
    try {
      const { userId, roles } = req.body;
      if (!userId) return res.status(400).json({ error: 'User ID is required' });

      const uId = parseInt(userId);

      // 1. Clear existing roles
      await this.db.delete(systemUsersToRoles)
        .where(eq(systemUsersToRoles.userId, uId));

      // 2. Add new roles
      if (Array.isArray(roles) && roles.length > 0) {
        const values = roles.map(roleSlug => ({
          userId: uId,
          roleSlug
        }));
        
        await this.db.insert(systemUsersToRoles)
          .values(values)
          .onConflictDoNothing();
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('[SystemController] saveUserRoles Error:', err);
      res.status(500).json({ error: 'Failed to save user roles: ' + err.message });
    }
  }

  async checkUpdate(req: Request, res: Response) {
    try {
      const status = await SystemUpdateService.checkUpdate();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to check for updates: ' + err.message });
    }
  }

  async applyUpdate(req: Request, res: Response) {
    try {
      const result = await SystemUpdateService.applyUpdate();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to apply update: ' + err.message });
    }
  }
}
