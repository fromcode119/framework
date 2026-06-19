/**
 * Clears cached admin assets (service workers + Cache Storage) and reloads the
 * page with a cache-busting query parameter to recover from stale JavaScript.
 */
export class IntegrationStaleJsService {
  static isSupported(): boolean {
    return typeof window !== 'undefined';
  }

  static async clearCaches(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    }
  }

  static reloadWithBuster(): void {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('fc_js_reset', Date.now().toString());
    window.location.replace(nextUrl.toString());
  }
}
