import { NamingStrategy } from '@fromcode119/database';
import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';


export class RolesContextProxy {

  /**
   * Creates a roles proxy for plugins.
   * Plugins should use context.roles.ensure() instead of querying the system roles table directly.
   */
  static createRolesProxy(manager: PluginManagerInterface) {
    return {
      async ensure(slug: string, data: { name: string; description?: string; type?: string; permissions?: any[] }): Promise<void> {
        const existing = await manager.db.findOne(SystemConstants.TABLE.ROLES, { slug });
        if (!existing) {
          await manager.db.insert(SystemConstants.TABLE.ROLES, {
            slug,
            name: data.name,
            description: data.description ?? '',
            type: data.type ?? 'custom',
            permissions: JSON.stringify(data.permissions ?? [])
          });
        }
      },

      /** Grant a role to a user (idempotent). Writes the user↔role junction via the string-table path. */
      async assignRole(userId: number | string, slug: string): Promise<void> {
        const uid = Number(userId);
        if (!uid || !slug) return;
        const existing = await manager.db.findOne(SystemConstants.TABLE.USERS_ROLES, { userId: uid, roleSlug: slug });
        if (!existing) {
          await manager.db.insert(SystemConstants.TABLE.USERS_ROLES, { userId: uid, roleSlug: slug });
        }
      },

      /** Revoke a role from a user (no-op if not assigned). */
      async removeRole(userId: number | string, slug: string): Promise<void> {
        const uid = Number(userId);
        if (!uid || !slug) return;
        await manager.db.delete(SystemConstants.TABLE.USERS_ROLES, { userId: uid, roleSlug: slug });
      },

      /** List the user ids that currently hold a given role (via the user↔role junction). */
      async listUserIdsWithRole(slug: string): Promise<number[]> {
        if (!slug) return [];
        const rows = await manager.db.find(SystemConstants.TABLE.USERS_ROLES, { where: { roleSlug: slug } }).catch(() => []);
        return (Array.isArray(rows) ? rows : [])
          .map((row: any) => Number(NamingStrategy.denormalizeRecord(row)?.userId))
          .filter((id: number) => Number.isFinite(id) && id > 0);
      }
    };

  }
}