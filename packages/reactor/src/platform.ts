/**
 * `Platform` — the one home for browser/SSR environment checks, so app code never hand-writes
 * `typeof window === 'undefined'` / `typeof document === 'undefined'` guards inline.
 *
 *   if (Platform.isBrowser) element.focus();          // DOM present
 *   const w = Platform.hasWindow ? window.innerWidth : 0;
 *
 * (This is the CLIENT-side runtime check. It is unrelated to the framework's server-side
 * `EnvUtils` which reads `process.env` — different concern, different package.)
 */
export class Platform {
  /** True when a live DOM is present (browser); false during SSR / Node. */
  static get isBrowser(): boolean {
    return typeof document !== 'undefined';
  }

  /** True when a global `window` object exists. */
  static get hasWindow(): boolean {
    return typeof window !== 'undefined';
  }
}
