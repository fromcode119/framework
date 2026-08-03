/**
 * Service worker for the admin-console PWA — authored in TypeScript and compiled to `public/sw.js` by the
 * `build:sw` step (never hand-written JS in the framework). A fetch handler is required for installability;
 * the strategy is network-first (the admin console must always show fresh data) with a cache fallback so the
 * app shell still opens offline. Only GET requests are handled; API/websocket calls fall through to the
 * network. Paths + cache name come from AdminServiceWorkerConstants. Domain-agnostic — no plugin/appearance
 * identity.
 *
 * This file runs in a ServiceWorkerGlobalScope, NOT the DOM — it is excluded from the app's tsconfig and
 * type-checked against the WebWorker lib via `service-worker/tsconfig.json`. The ambient global is
 * narrowed by the private `scope` accessor rather than a module-level `declare const self`, so nothing
 * lives outside the class.
 *
 * A worker entry has to start itself, and that bootstrap is BUILD glue, not source: `build:sw` bundles
 * with `--global-name=AdminServiceWorkerModule` and appends the `register()` call as a footer — the same
 * rule nextor applies to Next's route exports, so the only hand-written export here is `export class`.
 */
import { AdminServiceWorkerConstants } from '@/lib/pwa/constants/admin-service-worker.constants';

export class AdminServiceWorker {
  /**
   * The worker's own global, narrowed from the ambient `WorkerGlobalScope`.
   *
   * A service worker's `self` carries `clients`, `skipWaiting()` and the typed `fetch`/`activate` events
   * that the base worker scope does not. Reading it through an accessor keeps that narrowing INSIDE the
   * class — a module-level `declare const self` put a declaration outside it, and a `.d.ts` cannot express
   * this at all (an ambient global can only be shadowed from within a module).
   */
  private static get scope(): ServiceWorkerGlobalScope {
    return self as unknown as ServiceWorkerGlobalScope;
  }

  /** True when the request must bypass the cache entirely (live API/socket traffic). */
  private static isNetworkOnly(url: URL): boolean {
    return AdminServiceWorkerConstants.NETWORK_ONLY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  }

  /** Drop every cache except the current shell, then take control of open clients. */
  private static async activate(): Promise<void> {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== AdminServiceWorkerConstants.SHELL_CACHE).map((key) => caches.delete(key)),
    );
    await AdminServiceWorker.scope.clients.claim();
  }

  /** Network-first with a cache write-through; falls back to the cached copy when the network fails. */
  private static async networkFirst(request: Request): Promise<Response> {
    try {
      const response = await fetch(request);
      if (response && response.status === 200 && response.type === 'basic') {
        const copy = response.clone();
        caches
          .open(AdminServiceWorkerConstants.SHELL_CACHE)
          .then((cache) => cache.put(request, copy))
          .catch(() => { /* cache write is best-effort — never fail the response */ });
      }
      return response;
    } catch {
      // Offline: serve the cached shell. With no cached copy the request fails as a network error,
      // exactly as an unhandled fetch would.
      return (await caches.match(request)) ?? Response.error();
    }
  }

  static register(): void {
    const scope = AdminServiceWorker.scope;

    scope.addEventListener('install', () => {
      scope.skipWaiting();
    });

    scope.addEventListener('activate', (event) => {
      event.waitUntil(AdminServiceWorker.activate());
    });

    scope.addEventListener('fetch', (event) => {
      const request = event.request;
      if (request.method !== 'GET') return;
      if (AdminServiceWorker.isNetworkOnly(new URL(request.url))) return;
      event.respondWith(AdminServiceWorker.networkFirst(request));
    });
  }
}
