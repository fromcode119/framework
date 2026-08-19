import type { IPluginBatchSettleHost } from '@/lib/interfaces/plugin-batch-settle-host.interface';

export class PluginBatchUpdateWaitService {
  /** A docker api boot with a full plugin set takes ~60s; the budget must outlive it with margin. */
  private static readonly SETTLE_TIMEOUT_MS = 150 * 1000;
  private static readonly SETTLE_POLL_INTERVAL_MS = 2000;

  /**
   * The batch operation reports 'completed' ~2.5s BEFORE the scheduled restart actually kills the
   * api process, and the reboot takes about a minute — so this loop has to live THROUGH the
   * downtime. A failed refetch here means "the api is restarting", not "the update failed": it is
   * reported as calm progress text, never surfaced as an error. Resolves true once the caller
   * computes zero pending updates; false when the budget runs out with the catalog still stale —
   * the caller must NOT report success in that case.
   */
  static async waitUntilSettled(host: IPluginBatchSettleHost): Promise<boolean> {
    const deadline = Date.now() + this.SETTLE_TIMEOUT_MS;
    let sawApiDown = false;

    while (Date.now() < deadline) {
      if (!host.isStillMounted()) {
        return false;
      }

      try {
        await host.refetchCatalogInBackground();
        if (host.isCatalogSettled()) {
          return true;
        }
        host.reportSettleProgress(sawApiDown
          ? 'API is back — waiting for the catalog to show the new versions...'
          : 'Waiting for the API restart...');
      } catch {
        sawApiDown = true;
        host.reportSettleProgress('The API is restarting — waiting for it to come back...');
      }

      await new Promise((resolve) => setTimeout(resolve, this.SETTLE_POLL_INTERVAL_MS));
    }

    return false;
  }
}
