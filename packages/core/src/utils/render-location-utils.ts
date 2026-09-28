import { RuntimeConstants } from '@core/constants/runtime.constants';
import { EnvUtils } from '@core/utils/env-utils';

/**
 * Where the page being rendered lives, on either side of hydration.
 *
 * In the browser these are `window.location.pathname` / `.origin`. A server render has no window, so code
 * that read them took its "no location" branch there and its real branch in the browser: the account shell
 * painted the overview tab on the server and the requested section in the browser, and an absolute asset
 * URL came out relative on the server and absolute in the browser — both hydration mismatches. The theme
 * server render publishes the request's path and origin under `RuntimeConstants.GLOBALS` for the duration
 * of its synchronous render (as it does the prefetch payload), so both sides read the same values.
 */
export class RenderLocationUtils {
  static pathname(): string {
    if (!EnvUtils.isServer()) return window.location.pathname;
    return RenderLocationUtils.published(RuntimeConstants.GLOBALS.RENDER_PATH);
  }

  static origin(): string {
    if (!EnvUtils.isServer()) return window.location.origin;
    return RenderLocationUtils.published(RuntimeConstants.GLOBALS.RENDER_ORIGIN);
  }

  private static published(key: string): string {
    return String((globalThis as Record<string, unknown>)[key] || '');
  }
}
