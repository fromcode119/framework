import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';

export class RecordVersionsContextProxy {
  /**
   * Read-only record-versions proxy. Revisions live in the framework-managed `_system_record_versions`
   * table; plugins must NOT query it via context.db (that path is blocked) — they read history through
   * here. Uses the RAW manager db so the framework owns the only access to the system table.
   */
  static createRecordVersionsProxy(manager: PluginManagerInterface) {
    return {
      async getById(id: any): Promise<Record<string, any> | null> {
        if (id == null || id === '') return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.RECORD_VERSIONS, { id });
        return row ?? null;
      },

      async listByRef(refCollection: string, refId: any, limit = 20): Promise<Record<string, any>[]> {
        const rows = await manager.db.find(SystemConstants.TABLE.RECORD_VERSIONS, {
          where: { refCollection: String(refCollection), refId: String(refId) },
          limit,
          orderBy: { createdAt: 'desc' },
        });
        return Array.isArray(rows) ? rows : [];
      }
    };
  }
}
