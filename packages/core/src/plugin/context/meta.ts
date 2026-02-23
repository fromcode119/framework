import { PluginManagerInterface } from './utils';
import { SystemTable } from '@fromcode119/sdk/internal';

/**
 * Creates a read-only meta store proxy for plugins.
 * Plugins should use context.meta.get(key) instead of querying the system meta table directly.
 */
export function createMetaProxy(manager: PluginManagerInterface) {
  return {
    async get(key: string): Promise<string | null> {
      const row = await manager.db.findOne(SystemTable.META, { key: String(key) });
      return row?.value ?? null;
    }
  };
}
