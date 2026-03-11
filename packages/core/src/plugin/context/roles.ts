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
      }
    };

  }
}