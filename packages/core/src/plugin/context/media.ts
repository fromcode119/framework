import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';

export class MediaContextProxy {
  /**
   * Read-only media proxy for plugins. Plugins must NOT query the `media` system table via context.db
   * (that path is blocked) — they resolve a media item through here. Uses the RAW manager db so the
   * framework owns the only access to the system table.
   */
  static createMediaProxy(manager: PluginManagerInterface) {
    return {
      async findById(id: any): Promise<Record<string, any> | null> {
        if (id == null || id === '') return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.MEDIA, { id });
        return row ?? null;
      }
    };
  }
}
