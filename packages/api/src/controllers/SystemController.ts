import { Request, Response } from 'express';
import { PluginManager, ThemeManager } from '@fromcode/core';
import { 
  count, sql, systemLogs, systemAuditLogs, systemRoles, users, desc, eq, or, and, ilike,
  systemUsersToRoles, systemRolesToPermissions, systemPermissions,
  systemThemes
} from '@fromcode/database';
import { SystemUpdateService } from '@fromcode/core';
import { RESTController } from './RESTController';

export class SystemController {
  private db: any;

  constructor(private manager: PluginManager, private themeManager: ThemeManager, private restController: RESTController) {
    this.db = (manager as any).db.drizzle;
  }

  async getAdminMetadata(req: Request, res: Response) {
    const metadata = this.manager.getAdminMetadata() as any;

    // Include active theme runtime for admin so theme-extended CMS block
    // definitions can register in the editor (without injecting theme CSS).
    try {
      const runtimeModules = this.manager.getRuntimeModules();
      const frontendMeta = await this.themeManager.getFrontendMetadata(runtimeModules);

      if (frontendMeta?.activeTheme) {
        const theme = frontendMeta.activeTheme;
        metadata.activeTheme = {
          ...theme,
          ui: {
            ...(theme.ui || {}),
            css: []
          }
        };
      }

      if (frontendMeta?.runtimeModules) {
        metadata.runtimeModules = frontendMeta.runtimeModules;
      }
    } catch (e) {
      console.error('[SystemController] Failed to attach theme metadata for admin:', e);
    }
    
    // Fetch global settings to include in metadata for the UI
    try {
      const settings = await (this.manager as any).db.find('_system_meta');
      const settingsMap: Record<string, string> = {};
      settings.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });
      
      metadata.settings = settingsMap;
    } catch (e) {
      console.error('[SystemController] Failed to fetch settings for metadata:', e);
    }

    res.json(metadata);
  }

  async getFrontendMetadata(req: Request, res: Response) {
    const runtimeModules = this.manager.getRuntimeModules();
    res.json(await this.themeManager.getFrontendMetadata(runtimeModules));
  }

  async getThemes(req: Request, res: Response) {
    try {
      res.json(this.themeManager.getThemes());
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch themes: ' + err.message });
    }
  }

  async getMarketplaceThemes(req: Request, res: Response) {
    try {
      res.json(await this.themeManager.getMarketplaceThemes());
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch marketplace themes: ' + err.message });
    }
  }

  async activateTheme(req: Request, res: Response) {
    try {
      const { slug } = req.body;
      if (!slug) return res.status(400).json({ error: 'Theme slug is required' });
      await this.themeManager.activateTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to activate theme: ' + err.message });
    }
  }

  async installTheme(req: Request, res: Response) {
    try {
      const pkg = req.body;
      if (!pkg.slug || !pkg.downloadUrl) return res.status(400).json({ error: 'Invalid theme package' });
      await this.themeManager.installTheme(pkg);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to install theme: ' + err.message });
    }
  }

  async deleteTheme(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      await this.themeManager.deleteTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete theme: ' + err.message });
    }
  }

  async getStats(req: Request, res: Response) {
    const collections = this.manager.getCollections();
    const stats = await Promise.all(collections.map(async (c) => {
      try {
        const total = await (this.manager as any).db.count(c.tableName || c.slug);
        return {
          slug: c.slug,
          shortSlug: c.shortSlug || c.slug,
          pluginSlug: c.pluginSlug || 'system',
          name: c.name || c.slug,
          count: total,
          system: !!c.system,
          hidden: !!c.admin?.hidden,
          priority: c.priority || 100
        };
      } catch (e) {
        return { slug: c.slug, count: 0, error: true };
      }
    }));
    res.json(stats);
  }

  async getSecurityStats(req: Request, res: Response) {
    try {
      const summary = await (this.manager as any).getSecuritySummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch security stats: ' + err.message });
    }
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

      let whereClause: any = undefined;
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

  async getAuditLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string || '');
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      let whereClause: any = undefined;
      const conditions: any[] = [];

      if (search) {
        conditions.push(or(
          ilike(systemAuditLogs.resource, `%${search}%`),
          ilike(systemAuditLogs.action, `%${search}%`),
          ilike(systemAuditLogs.pluginSlug, `%${search}%`)
        ));
      }

      if (status) {
        conditions.push(eq(systemAuditLogs.status, status));
      }

      const totalResult = await this.db.select({ value: count() })
        .from(systemAuditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const totalDocs = Number(totalResult[0]?.value || 0);

      const logs = await this.db.select()
        .from(systemAuditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(systemAuditLogs.createdAt))
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
      console.error('[SystemController] Audit Log Fetch Error:', err);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
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
        await this.db.delete(systemUsersToRoles).where(eq(systemUsersToRoles.userId, userId as any));
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

  async getEvents(req: Request, res: Response) {
    // Basic settings for long-lived keep-alive connection
    req.socket.setKeepAlive(true, 1000); // Send TCP keep-alive every second
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);

    // Atomic header write to prevent "incomplete chunked encoding" errors
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Content-Encoding': 'identity' // Prevent compression from breaking the stream
    });

    // Padding (2KB) to satisfy some proxies and browsers that buffer small responses
    res.write(':' + ' '.repeat(2048) + '\n\n');
    
    // Tell the client to retry every 10 seconds if connection is lost
    res.write('retry: 10000\n\n');
    res.write(': connection established\n\n');

    const handler = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if ((res as any).flush) (res as any).flush();
    };

    this.manager.hooks.on('system:hmr:reload', handler);

    // Heartbeat every 15 seconds to keep the connection alive thru proxies
    const heartbeat = setInterval(() => {
      // Using a comment (starting with :) as a heartbeat is standard SSE practice
      res.write(': heartbeat\n\n');
      if ((res as any).flush) (res as any).flush();
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.manager.hooks.off('system:hmr:reload', handler);
      // No need to call res.end() here as the socket is already closing/closed
    });
  }

  async resolveSlug(req: Request, res: Response) {
    const slug = req.query.slug as string;
    if (!slug) return res.status(400).json({ error: 'Slug is required' });

    // Fetch the global permalink structure to know how to search
    let permalinkStructure = '/:slug';
    try {
      const settings = await (this.manager as any).db.find('_system_meta');
      const permSetting = settings.find((s: any) => s.key === 'permalink_structure');
      if (permSetting) permalinkStructure = permSetting.value;
    } catch (e) {
      console.error('[SystemController] Failed to fetch permalink structure for resolution:', e);
    }

    const isNumericSearch = permalinkStructure.includes(':id') && !permalinkStructure.includes(':slug');
    const collections = this.manager.getCollections();
    const isAdmin = (req as any).user && (req as any).user.roles && (req as any).user.roles.includes('admin');
    const isPreview = req.query.preview === '1' || req.query.draft === '1';
    
    // Check if the referer has preview flags (fallback for frontend forwarding issues)
    const referer = req.headers.referer || '';
    const refererHasPreview = referer.includes('preview=1') || referer.includes('draft=1');
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isFromAdmin = referer && (referer.includes('admin.') || referer.includes(':3001'));
    
    // SECURE PREVIEW LOGIC:
    const requestHasPreviewFlag = isPreview || refererHasPreview;
    // In development mode or if coming from admin, we trust the preview flag more easily
    const userHasAccess = isAdmin || isFromAdmin || (isDevelopment && requestHasPreviewFlag);
    const effectivePreview = requestHasPreviewFlag && userHasAccess;

    console.log(`[SystemController] Resolving slug: "${slug}" (Structure: ${permalinkStructure})`);

    const normalizedSlug = slug.startsWith('/') ? slug.substring(1) : slug;
    const pathSegments = normalizedSlug.split('/').filter(Boolean);
    const structureSegments = permalinkStructure.split('/').filter(Boolean);

    // 1. PRIORITY SEARCH: Check for exact "Custom Permalink" override first
    for (const collection of collections) {
      if (collection.slug.startsWith('_') || collection.system) continue;
      const hasCustomField = collection.fields.some(f => f.name === 'customPermalink');
      const hasSlugField = collection.fields.some(f => f.name === 'slug');
      if (!hasCustomField && !hasSlugField) continue;

      try {
        // Try searching by customPermalink first
        if (hasCustomField) {
          const results = await this.restController.find(collection, {
            query: { customPermalink: normalizedSlug, limit: 1, preview: effectivePreview ? '1' : '0' },
            user: (req as any).user
          } as any);
          
          if (results && results.docs && results.docs.length > 0) {
            console.log(`[SystemController] Match found via customPermalink in ${collection.slug}`);
            return res.json({
              type: collection.shortSlug || collection.slug,
              plugin: (collection as any).pluginSlug,
              doc: results.docs[0]
            });
          }
        }

        // If it's a single segment slug (e.g. /my-post), try direct slug match 
        // to support top-level dynamic routing if desired
        if (hasSlugField && pathSegments.length === 1 && !permalinkStructure.includes(':slug')) {
          const results = await this.restController.find(collection, {
            query: { slug: normalizedSlug, limit: 1, preview: effectivePreview ? '1' : '0' },
            user: (req as any).user
          } as any);

          if (results && results.docs && results.docs.length > 0) {
            console.log(`[SystemController] Match found via top-level slug in ${collection.slug}`);
            return res.json({
              type: collection.shortSlug || collection.slug,
              plugin: (collection as any).pluginSlug,
              doc: results.docs[0]
            });
          }
        }
      } catch (e: any) {
        console.error(`[SystemController] Priority search error for ${collection.slug}:`, e);
      }
    }

    // 2. STRUCTURE SEARCH: Search based on the global permalink structure
    // We only perform this if the URL doesn't look like a direct collection access (e.g. /posts/my-post)
    // Wait, the user is requesting /posts/industrial-excellence.
    // If permalinkStructure is /:slug, this matches.
    
    for (const collection of collections) {
      if (collection.slug.startsWith('_') || collection.system) continue;
      
      const hasSlugField = collection.fields.some(f => f.name === 'slug');
      if (!hasSlugField && !permalinkStructure.includes(':id')) continue;

      try {
        let searchId: number | null = null;
        let searchSlug: string | null = null;

        // A. Handle matching path segments to structure variables (e.g. /:slug/:id -> /post-name/123)
        // Check if the current collection matches the prefix IF THERE IS ONE
        const collectionPrefix = (collection as any).shortSlug || collection.slug;
        
        if (pathSegments.length > 0 && pathSegments[0] === collectionPrefix) {
           // This is /posts/my-post, and we are looking at the 'posts' collection
           // In this case, the rest of pathSegments is the slug
           searchSlug = pathSegments.slice(1).join('/');
        } else if (pathSegments.length === structureSegments.length) {
          structureSegments.forEach((seg, idx) => {
            if (seg === ':id') {
              const val = parseInt(pathSegments[idx]);
              if (!isNaN(val)) searchId = val;
            } else if (seg === ':slug') {
              searchSlug = pathSegments[idx];
            }
          });
        }

        // Execute search
        if (searchId || searchSlug) {
           const query: any = { limit: 1, preview: effectivePreview ? '1' : '0' };
           if (searchId) query.id = searchId;
           if (searchSlug) query.slug = searchSlug;

           const result = await this.restController.find(collection, {
             query,
             user: (req as any).user
           } as any);

           if (result && result.docs && result.docs.length > 0) {
              console.log(`[SystemController] Match found via structure in ${collection.slug}: ${result.docs[0].title || result.docs[0].slug}`);
              return res.json({
                type: (collection as any).shortSlug || collection.slug,
                plugin: (collection as any).pluginSlug,
                doc: result.docs[0]
              });
           }
        }
      } catch (e: any) {
        console.error(`[SystemController] Structure search error for ${collection.slug}:`, e.message);
      }
    }

    res.status(404).json({ error: 'Not found' });
  }
}
