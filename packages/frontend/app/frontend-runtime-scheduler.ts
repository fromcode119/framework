/**
 * Defers theme/plugin runtime bundles until after the document has painted and gone quiet.
 *
 * Before the storefront server-rendered anything, these bundles WERE the page — nothing was visible
 * until they ran, so they had to load as early as possible. That is no longer true: the server now ships
 * the layout and the block flow as HTML, so the page is visually complete before a single runtime bundle
 * is fetched. Loading ~790 KB of plugin JavaScript while the browser is still fetching the LCP image
 * only makes that image arrive later.
 *
 * They still load — this changes WHEN, not WHETHER — so every interactive surface arrives as before,
 * just after the paint instead of competing with it.
 *
 * Falls through to running immediately when the page has already loaded (a client-side navigation, or a
 * remount), so a later mount never waits for an event that has been and gone.
 */
export class FrontendRuntimeScheduler {
  private static flushed = false;

  private static queued: Array<() => void> = [];

  static run(task: () => void): void {
    if (FrontendRuntimeScheduler.flushed || document.readyState === 'complete') {
      FrontendRuntimeScheduler.flushed = true;
      task();
      return;
    }

    FrontendRuntimeScheduler.queued.push(task);
    if (FrontendRuntimeScheduler.queued.length > 1) return;
    window.addEventListener('load', FrontendRuntimeScheduler.onLoad, { once: true });
  }

  private static onLoad(): void {
    // One idle slice after `load`: `load` fires once the initial resources are in, and the idle callback
    // then yields to whatever paint work is still queued. The timeout is the floor — a page that never
    // goes idle must still become interactive.
    const flush = () => FrontendRuntimeScheduler.flush();
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(flush, { timeout: 1500 });
      return;
    }
    window.setTimeout(flush, 200);
  }

  private static flush(): void {
    if (FrontendRuntimeScheduler.flushed) return;
    FrontendRuntimeScheduler.flushed = true;
    const tasks = FrontendRuntimeScheduler.queued;
    FrontendRuntimeScheduler.queued = [];
    for (const task of tasks) task();
  }
}
