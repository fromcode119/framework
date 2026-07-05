import { IDatabaseManager } from '@fromcode119/database';
import { Logger, StringUtils } from '@fromcode119/core';

export class UserPermissionChecker {
  private logger = new Logger({ namespace: 'permission-checker' });

  constructor(private db: IDatabaseManager) {}

  /**
   * Effective role slugs for a user = the legacy `users.roles` JSON column UNION the assignable
   * `_system_users_roles` junction (managed by the admin Roles UI and plugins like MLM). Without this
   * union, roles granted only through the junction would never reach permission checks — a silent
   * no-op. Junction rows are snake_case (`role_slug`), the framework-internal raw-manager convention.
   */
  private async resolveUserRoleSlugs(userId: number, user: any): Promise<string[]> {
    let assigned: unknown[] = [];
    try {
      const rows = await this.db.find('_system_users_roles', { where: { userId } });
      assigned = (Array.isArray(rows) ? rows : []).map((row: any) => row?.role_slug);
    } catch {
      // Junction table may be absent on older installs — fall back to the JSON column only.
    }
    // `user.roles` may be an array or a JSON-array string; normalizeSlugList handles both + the junction.
    return StringUtils.normalizeSlugList(user?.roles, assigned);
  }

  async hasPermission(userId: number, permission: string): Promise<boolean> {
    this.logger.debug(`Checking permission "${permission}" for userId ${userId}`);

    // 1. Get user and their roles using database SDK (table prefix added automatically)
    const user = await this.db.findOne('users', { id: userId });

    if (!user) {
      this.logger.debug(`User ${userId} not found`);
      return false;
    }

    // Effective roles = users.roles JSON ∪ _system_users_roles junction
    const userRoles = await this.resolveUserRoleSlugs(userId, user);

    this.logger.debug(`User ${userId} has ${userRoles.length} role(s)`);

    if (userRoles.length === 0) return false;
    
    // 2. Get all permissions for those roles from systemRoles table
    const allRoles = await this.db.find('_system_roles', { limit: 100 });
    
    const userRoleData = allRoles.filter(role => userRoles.includes(role.slug));
    
    this.logger.debug(`Found ${userRoleData.length} matching role(s) in systemRoles table`);
    
    // Collect all permissions from all roles
    const allPermissions: string[] = [];
    for (const role of userRoleData) {
      try {
        const perms = typeof role.permissions === 'string' 
          ? JSON.parse(role.permissions) 
          : (role.permissions || []);
        if (Array.isArray(perms)) {
          allPermissions.push(...perms);
        }
      } catch (err) {
        this.logger.warn(`Failed to parse permissions for role ${role.slug}: ${String((err as any)?.message || err)}`);
      }
    }
    
    this.logger.debug(`Resolved ${allPermissions.length} permission entries for user ${userId}`);
    
    // 3. Check wildcards
    if (allPermissions.includes('*')) {
      this.logger.debug(`Permission granted via wildcard '*'`);
      return true;
    }
    if (allPermissions.includes(permission)) {
      this.logger.debug(`Permission granted via exact match "${permission}"`);
      return true;
    }
    
    // 4. Check hierarchical wildcards (e.g., 'database:*' covers 'database:read')
    for (const perm of allPermissions) {
      if (perm.endsWith(':*')) {
        const permPrefix = perm.slice(0, -1);
        if (permission.startsWith(permPrefix)) {
          this.logger.debug(`Permission granted via hierarchical wildcard "${perm}"`);
          return true;
        }
      }
    }
    
    this.logger.debug(`Permission denied for "${permission}"`);
    return false;
  }
  
  async getUserPermissions(userId: number): Promise<string[]> {
    // Get user and their roles
    const user = await this.db.findOne('users', { id: userId });

    if (!user) return [];

    const userRoles = await this.resolveUserRoleSlugs(userId, user);

    if (userRoles.length === 0) return [];
    
    // Get all roles and filter by user's roles
    const allRoles = await this.db.find('_system_roles', { limit: 100 });
    const userRoleData = allRoles.filter(role => userRoles.includes(role.slug));
    
    const allPermissions: string[] = [];
    for (const role of userRoleData) {
      try {
        const perms = typeof role.permissions === 'string' 
          ? JSON.parse(role.permissions) 
          : (role.permissions || []);
        if (Array.isArray(perms)) {
          allPermissions.push(...perms);
        }
      } catch {
        // Skip invalid JSON
      }
    }
    
    return [...new Set(allPermissions)]; // Remove duplicates
  }
}