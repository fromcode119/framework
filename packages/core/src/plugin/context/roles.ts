import { PluginManagerInterface } from './utils';
import { SystemTable } from '@fromcode119/sdk/internal';

/**
 * Creates a roles proxy for plugins.
 * Plugins should use context.roles.ensure() instead of querying the system roles table directly.
 */
export function createRolesProxy(manager: PluginManagerInterface) {
  return {
    async ensure(slug: string, data: { name: string; description?: string; type?: string; permissions?: any[] }): Promise<void> {
      const existing = await manager.db.findOne(SystemTable.ROLES, { slug });
      if (!existing) {
        await manager.db.insert(SystemTable.ROLES, {
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
