import { NamingStrategy } from '@fromcode119/database';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';

export class MediaContextProxy {
  /** Never resolve more than this many ids in one statement, so one call cannot become an unbounded IN list. */
  private static readonly MAX_BATCH = 500;

  /**
   * Rows leave here in the SAME shape as `context.db` rows: camelCase, one canonical name per field.
   *
   * The raw manager returns the physical snake_case columns, so plugins reading `originalName` got
   * `undefined` and had to reach for `original_name` — the dual-spelling read this codebase forbids,
   * forced on them by the framework leaking its own internals across the boundary.
   */
  private static denormalize(row: any): Record<string, any> | null {
    return row ? NamingStrategy.denormalizeRecord(row) : null;
  }

  /**
   * Read-only media proxy for plugins. Plugins must NOT query the `media` system table via context.db
   * (that path is blocked) — they resolve a media item through here. Uses the RAW manager db so the
   * framework owns the only access to the system table.
   *
   * The raw db is not an isolation hole: under tenancy the `media` table carries row-level security
   * (a bespoke policy, because media also admits shared assets — see `TenantScopedTableDdl`), and the
   * app connects as a non-superuser role, so the tenant filter is enforced by the CONNECTION and
   * applies to every statement here. A plugin cannot resolve another tenant's media by guessing an id.
   */
  static createMediaProxy(manager: IPluginManagerInterface) {
    return {
      async findById(id: any): Promise<Record<string, any> | null> {
        if (id == null || id === '') return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.MEDIA, { id });
        return MediaContextProxy.denormalize(row);
      },
      /**
       * Resolve MANY ids in one statement, keyed by id.
       *
       * Without this, a list of N records each carrying a media reference costs N round trips — the
       * documents list was doing exactly that, one `findById` per row inside the render loop. The
       * result is a map rather than an array because the caller is joining it onto rows it already
       * has, and because a missing or unreadable id must be an absent key, not a silent shift in
       * position.
       */
      async findByIds(ids: any[]): Promise<Map<string, Record<string, any>>> {
        const unique = Array.from(new Set((ids || []).filter((id) => id != null && id !== '').map(String)));
        const resolved = new Map<string, Record<string, any>>();
        if (unique.length === 0) return resolved;

        for (let start = 0; start < unique.length; start += MediaContextProxy.MAX_BATCH) {
          const batch = unique.slice(start, start + MediaContextProxy.MAX_BATCH);
          const rows = await manager.db.find(SystemConstants.TABLE.MEDIA, {
            where: { id: { in: batch } },
            limit: batch.length,
          });
          for (const row of Array.isArray(rows) ? rows : []) {
            const record = MediaContextProxy.denormalize(row);
            if (record?.id != null) resolved.set(String(record.id), record);
          }
        }
        return resolved;
      },
      /**
       * List media records (newest first). The sanctioned way for plugins (e.g. a media
       * library) to enumerate media — they must NOT query the `media` system table via context.db.
       */
      async list(options?: { limit?: number; offset?: number }): Promise<Array<Record<string, any>>> {
        const limit = Math.max(1, Math.min(Number(options?.limit) || 50, MediaContextProxy.MAX_BATCH));
        const findOptions: Record<string, any> = { limit, orderBy: { createdAt: 'desc' } };
        const offset = Number(options?.offset) || 0;
        if (offset > 0) findOptions.offset = offset;
        const rows = await manager.db.find(SystemConstants.TABLE.MEDIA, findOptions);
        return (Array.isArray(rows) ? rows : []).map((row) => MediaContextProxy.denormalize(row) as Record<string, any>);
      },
      /** Count media records — sanctioned alternative to a blocked `context.db.count('media')`. */
      async count(): Promise<number> {
        const total = await manager.db.count(SystemConstants.TABLE.MEDIA, {});
        return Number(total) || 0;
      }
    };
  }
}
