import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';

export class MetaContextProxy {
  /**
   * Creates a read-only meta store proxy for plugins.
   * Plugins should use context.meta.get(key) instead of querying the system meta table directly.
   */
  static createMetaProxy(manager: PluginManagerInterface) {
    return {
      async get(key: string): Promise<string | null> {
        const row = await manager.db.findOne(SystemConstants.TABLE.META, { key: String(key) });
        return row?.value ?? null;
      }
    };

  }
}