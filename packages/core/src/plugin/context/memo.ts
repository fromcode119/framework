import type { IPluginContextMemo } from '@core/plugin/interfaces/plugin-context-memo.interface';

/**
 * `context.memo` on the api side. Plugins run in their own processes, which keep these answers
 * themselves (PluginGuestSiteCache); anything calling the api-side context gets a fresh answer.
 */
export class MemoContextProxy {
  static createMemoProxy(): IPluginContextMemo {
    return { forSite: async <T>(_key: string, compute: () => T | Promise<T>): Promise<T> => compute() };
  }
}
