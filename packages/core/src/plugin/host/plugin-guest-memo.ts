import type { IPluginContextMemo } from '@core/plugin/interfaces/plugin-context-memo.interface';
import { PluginGuestSiteCache } from '@core/plugin/host/plugin-guest-site-cache';

/** `context.memo` in a plugin process: kept per site and revision (PluginGuestSiteCache), handed out as copies. */
export class PluginGuestMemo {
  private readonly cache = new PluginGuestSiteCache();

  api(): IPluginContextMemo {
    return {
      forSite: async <T>(key: string, compute: () => T | Promise<T>): Promise<T> => structuredClone(await this.cache.read(`memo\u0000${key}`, compute)) as T,
    };
  }
}
