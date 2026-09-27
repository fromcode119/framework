/**
 * What happens to the storefront renderer after the extensions it renders from change on disk.
 *
 * It used to RESTART the frontend: each theme/plugin `ui-ssr/entry.mjs` was imported once for the life of
 * the process, and re-importing in place left a stale world that rendered empty values. That restart was
 * itself an outage — with one frontend container, every storefront answered 502 until it was back, on
 * every plugin install.
 *
 * Neither is needed now. The storefront renders in render hosts keyed by a signature that carries a stamp
 * of each bundle on disk (`ThemeSsrBundles` in the frontend), so changed files — a new version or a
 * rebuild at the same one — are a new signature: the next render for a site builds a fresh world beside
 * the old one and switches to it, and the old world keeps serving until then. So this only says so.
 */
export class StorefrontRendererRefreshService {
  /**
   * @param reason what changed, for the log — e.g. `theme "<slug>" installed`.
   */
  static async afterExtensionsChanged(
    reason: string,
    logger?: { info(message: string): void; warn(message: string): void },
  ): Promise<void> {
    logger?.info(`Storefront picks up ${reason} on each site's next render: its bundles changed on disk, so a fresh render world is built beside the current one — no restart.`);
  }
}
