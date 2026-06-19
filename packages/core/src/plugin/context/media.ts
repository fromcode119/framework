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
      },
      /**
       * List media records (newest first). The sanctioned way for plugins (e.g. the CMS media
       * library) to enumerate media — they must NOT query the `media` system table via context.db.
       */
      async list(options?: { limit?: number; offset?: number }): Promise<Array<Record<string, any>>> {
        const limit = Math.max(1, Math.min(Number(options?.limit) || 50, 500));
        const findOptions: Record<string, any> = { limit, orderBy: { createdAt: 'desc' } };
        const offset = Number(options?.offset) || 0;
        if (offset > 0) findOptions.offset = offset;
        const rows = await manager.db.find(SystemConstants.TABLE.MEDIA, findOptions);
        return Array.isArray(rows) ? rows : [];
      },
      /** Count media records — sanctioned alternative to a blocked `context.db.count('media')`. */
      async count(): Promise<number> {
        const total = await manager.db.count(SystemConstants.TABLE.MEDIA, {});
        return Number(total) || 0;
      }
    };
  }
}
