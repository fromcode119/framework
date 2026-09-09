import { ApplicationRestartService } from '@core/management/application-restart-service';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';

/**
 * Restarts the storefront renderer after the extensions it renders from change on disk.
 *
 * The frontend imports each theme/plugin `ui-ssr/entry.mjs` ONCE and keeps the resulting module world
 * for the life of the process. Replacing those files under it — a theme install, update or activation —
 * leaves that world stale, and re-importing them in place produces a SECOND set of instances whose
 * registries and plugin clients no longer match the ones the loaded components hold. Rendering keeps
 * succeeding; it just silently yields empty values for everything plugin- or translation-derived. On a
 * live storefront that read as product prices, delivery estimates and social-proof labels vanishing
 * from the server-rendered HTML, with no error anywhere and no way to tell from the page that anything
 * had failed. The only reliable repair was a manual restart nobody knew to perform.
 *
 * So the install performs it. This is deliberately a RESTART and not a hot reload: a fresh process is
 * the one state we know renders what is actually on disk.
 *
 * Never fatal. An install that succeeded must not be reported as failed because the renderer could not
 * be reached — and on a deployment that runs no frontend (api-only, api+admin), "no frontend to
 * restart" is the correct and expected answer, which {@link ApplicationRestartService} already returns
 * as a stated reason rather than an error.
 */
export class StorefrontRendererRefreshService {
  /**
   * @param reason what changed, for the log — e.g. `theme "<slug>" installed`.
   */
  static async afterExtensionsChanged(
    reason: string,
    logger?: { info(message: string): void; warn(message: string): void },
  ): Promise<void> {
    const app = ApplicationUrlUtils.FRONTEND_APP;
    const outcome = await new ApplicationRestartService(logger).restart(app, `${reason} (storefront renderer refresh)`);

    if (outcome.restarting) {
      logger?.info(`Storefront renderer restarting after ${reason} — it renders from the files that just changed.`);
      return;
    }
    // Stated, never silent: if this deployment does run a storefront, someone has to know the pages it
    // serves are still rendering from the previous files.
    logger?.warn(
      `Storefront renderer NOT refreshed after ${reason}: ${outcome.reason} `
      + 'If this deployment serves a storefront, restart the frontend app or its server-rendered pages '
      + 'will keep rendering from the previous extension files.',
    );
  }
}
