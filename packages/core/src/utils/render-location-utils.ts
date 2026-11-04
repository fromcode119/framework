import { EnvUtils } from '@core/utils/env-utils';
import type { IRenderLocation } from '@core/utils/interfaces/render-location.interface';

/**
 * Where the page being rendered lives, on either side of hydration.
 *
 * In the browser these are `window.location.pathname` / `.origin` / `.search`. A server render has no
 * window, so code that read them took its "no location" branch there and its real branch in the browser:
 * the account shell painted the overview tab on the server and the requested section in the browser, and
 * an absolute asset URL came out relative on the server and absolute in the browser — both hydration
 * mismatches. The theme server render runs inside `renderAt(location, render)`, so both sides read the
 * same values.
 *
 * The location is held in this module, never on `globalThis`: a global is writable by any script in the
 * process, and `renderToString` is synchronous, so a scope that is set before the render and restored in
 * `finally` is exactly as wide as the render and nothing else can observe or replace it.
 */
export class RenderLocationUtils {
  private static current: IRenderLocation | null = null;

  /** Run a synchronous server render with `location` as the page's address. */
  static renderAt<T>(location: IRenderLocation, render: () => T): T {
    const previous = RenderLocationUtils.current;
    RenderLocationUtils.current = { path: location.path || '', origin: location.origin || '', search: location.search || '' };
    try {
      return render();
    } finally {
      RenderLocationUtils.current = previous;
    }
  }

  static pathname(): string {
    if (!EnvUtils.isServer()) return window.location.pathname;
    return RenderLocationUtils.current?.path || '';
  }

  static origin(): string {
    if (!EnvUtils.isServer()) return window.location.origin;
    return RenderLocationUtils.current?.origin || '';
  }

  /**
   * The page address's query string (`?category=kids`, or `''`). A list filtered by the address painted
   * the unfiltered list on the server and the filtered one in the browser; read here, both sides agree.
   */
  static search(): string {
    if (!EnvUtils.isServer()) return window.location.search;
    return RenderLocationUtils.current?.search || '';
  }
}
