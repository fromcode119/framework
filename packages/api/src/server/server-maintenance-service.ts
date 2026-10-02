import { CacheManager } from '@fromcode119/cache';
import { Logger, PluginManager, SystemConstants } from '@fromcode119/core';

export class ServerMaintenanceService {
  /**
   * How long one answer stands. Every request asks, and each answer is a Redis round trip: under load
   * that was a network call per request for a flag that changes a few times a year. Within this window
   * requests share one lookup; a switch made on another api reaches this one within it.
   */
  static readonly STATUS_REUSE_MS = 1000;
  private recent: { at: number; status: Promise<boolean> } | null = null;

  constructor(
    private manager: PluginManager,
    private cache: CacheManager,
    private settingsCache: Map<string, string>,
    private logger: Logger,
  ) {}

  getStatus(): Promise<boolean> {
    const now = Date.now();
    if (this.recent && now - this.recent.at < ServerMaintenanceService.STATUS_REUSE_MS) return this.recent.status;
    const status = this.lookUpStatus();
    this.recent = { at: now, status };
    return status;
  }

  private async lookUpStatus(): Promise<boolean> {
    try {
      let redisVal = await this.cache.get(`system_setting:${SystemConstants.META_KEY.MAINTENANCE_MODE}`);
      const memoryVal = this.settingsCache.get(SystemConstants.META_KEY.MAINTENANCE_MODE);

      let val = redisVal;
      if (val === null || val === undefined) {
        val = memoryVal;
      }

      if (val === null || val === undefined) {
        const db = (this.manager as any).db;
        const hasMetaTable = await db.tableExists(SystemConstants.TABLE.META);
        if (!hasMetaTable) {
          return true;
        }

        const row = await db.findOne(SystemConstants.TABLE.META, {
          key: SystemConstants.META_KEY.MAINTENANCE_MODE,
        });

        if (row) {
          val = row.value;
          this.settingsCache.set(SystemConstants.META_KEY.MAINTENANCE_MODE, row.value);
          await this.cache.set(`system_setting:${SystemConstants.META_KEY.MAINTENANCE_MODE}`, row.value);
        }
      }

      if (val !== null && val !== undefined) {
        const isTrue = String(val).toLowerCase() === 'true';
        if (isTrue) {
          this.logger.debug(`Maintenance is ON (Redis: ${redisVal}, Memory: ${memoryVal}, Final: ${val})`);
        }
        return isTrue;
      }

      this.logger.warn('Could not determine maintenance status - failing closed (ON)');
      return true;
    } catch (error) {
      this.logger.error('Error determining maintenance status - failing closed (ON):', error);
      return true;
    }
  }
}
