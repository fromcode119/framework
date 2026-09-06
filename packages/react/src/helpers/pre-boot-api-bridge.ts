/**
 * The API surface a plugin sees BEFORE the provider is mounted.
 *
 * Under the islands runtime, theme and plugin bundles evaluate against the pre-boot bridge. A client a
 * plugin registers at evaluation (`ContextBridge.registerPluginScopeApi`) captures `ContextBridge.api` —
 * a proxy that resolves each method at call time, so it is live once the provider installs. This class
 * is what that proxy resolves to in the meantime: every method waits for the live API and then delegates
 * to it, so a request made in the gap is delivered, not dropped. Nothing is invented — no base URL, no
 * headers; the live client owns all of that.
 */
export class PreBootApiBridge {
  private static readonly METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

  private static live: Record<string, any> | null = null;

  private static waiters: Array<(api: Record<string, any>) => void> = [];

  /** The deferring API object handed to the pre-boot install as `stableApiBridge`. */
  static create(): Record<string, any> {
    const api: Record<string, any> = {
      getBaseUrl: () => String(PreBootApiBridge.live?.getBaseUrl?.() || ''),
    };
    for (const method of PreBootApiBridge.METHODS) {
      api[method] = (...args: unknown[]) => PreBootApiBridge.whenLive().then((target) => target[method](...args));
    }
    return api;
  }

  /** Called by the live install: releases every request made while no provider existed. */
  static resolve(api: Record<string, any>): void {
    if (!api || api === PreBootApiBridge.live) return;
    PreBootApiBridge.live = api;
    const waiters = PreBootApiBridge.waiters;
    PreBootApiBridge.waiters = [];
    waiters.forEach((waiter) => waiter(api));
  }

  /** True once a live provider's API has been installed. */
  static get isLive(): boolean {
    return PreBootApiBridge.live !== null;
  }

  private static whenLive(): Promise<Record<string, any>> {
    if (PreBootApiBridge.live) return Promise.resolve(PreBootApiBridge.live);
    return new Promise((resolve) => PreBootApiBridge.waiters.push(resolve));
  }
}
