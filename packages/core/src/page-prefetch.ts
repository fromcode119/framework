import { EnvUtils } from '@core/utils/env-utils';

/**
 * The data the server prefetched for the page being rendered (nav menus, page-scoped records, …), keyed
 * by the prefetch entry's `key`. It is absent on client-side navigations and when a prefetch failed, so
 * every reader keeps its fetch fallback.
 *
 * Server: the theme render runs inside `renderWith(payload, render)`. Browser: the server emits each
 * payload as `<script type="application/json" data-fc-page-prefetch>`; they are parsed here in document
 * order and merged. Neither side uses a writable global — inert JSON cannot run, and a script cannot
 * replace what this module returns.
 */
export class PagePrefetch {
  static readonly SCRIPT_ATTRIBUTE = 'data-fc-page-prefetch';

  private static serverPayload: Readonly<Record<string, unknown>> | null = null;
  private static clientPayload: Readonly<Record<string, unknown>> = Object.freeze({});
  private static clientScriptCount = -1;

  /** The prefetched value for `key`, or null. */
  static get(key: string): unknown {
    return PagePrefetch.all()[key] ?? null;
  }

  /** Every prefetched value of the page, read-only. */
  static all(): Readonly<Record<string, unknown>> {
    if (EnvUtils.isServer()) return PagePrefetch.serverPayload || {};
    return PagePrefetch.readClient();
  }

  /** Run a synchronous server render with `payload` as the page's prefetched data. */
  static renderWith<T>(payload: Record<string, unknown>, render: () => T): T {
    const previous = PagePrefetch.serverPayload;
    PagePrefetch.serverPayload = Object.freeze({ ...(payload || {}) });
    try {
      return render();
    } finally {
      PagePrefetch.serverPayload = previous;
    }
  }

  private static readClient(): Readonly<Record<string, unknown>> {
    const scripts = document.querySelectorAll(`script[type="application/json"][${PagePrefetch.SCRIPT_ATTRIBUTE}]`);
    if (scripts.length === PagePrefetch.clientScriptCount) return PagePrefetch.clientPayload;
    const merged: Record<string, unknown> = {};
    scripts.forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(merged, parsed);
      } catch {
        // A payload that does not parse is no payload; readers keep their fetch fallback.
      }
    });
    PagePrefetch.clientScriptCount = scripts.length;
    PagePrefetch.clientPayload = Object.freeze(merged);
    return PagePrefetch.clientPayload;
  }
}
