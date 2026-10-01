/**
 * The storefront's service worker — authored in TypeScript and compiled to `public/fc-push-worker.js` by
 * the `build:sw` step. It exists for one thing: a customer who turned notifications on gets them while
 * the site is closed. It handles no fetches and caches nothing; a storefront page is always the network's.
 *
 * Like the console's worker, the bootstrap is build glue: `build:sw` appends the `register()` call.
 */
import { PushNotificationWorker } from '@core/push/push-notification-worker';

export class StorefrontServiceWorker {
  static register(): void {
    const scope = self as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    scope.addEventListener('install', () => scope.skipWaiting());
    scope.addEventListener('activate', (event: any) => event.waitUntil(scope.clients.claim())); // eslint-disable-line @typescript-eslint/no-explicit-any
    PushNotificationWorker.listen(scope);
  }
}
