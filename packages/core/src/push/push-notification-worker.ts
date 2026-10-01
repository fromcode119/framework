/**
 * What a service worker does with a push message — shared by the console's worker and the storefront's.
 *
 * It shows the message (a browser requires every push to be shown) and, when it is clicked, focuses a
 * tab already on that page or opens one. A link always resolves inside the worker's own scope and
 * origin: a message can send someone to a page of this site, never somewhere else.
 *
 * Bundled INTO a worker, so it imports nothing — a barrel import would pull server code (crypto) into
 * a scope that has none. The worker scope is typed loosely on purpose: this package is compiled with
 * the DOM library, the workers with the WebWorker one.
 */
export class PushNotificationWorker {
  /** Where the storefront's worker is served (`frontend` `build:sw` writes it there). */
  static readonly STOREFRONT_SCRIPT = '/fc-push-worker.js';

  static listen(scope: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    scope.addEventListener('push', (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      event.waitUntil(PushNotificationWorker.show(scope, event));
    });
    scope.addEventListener('notificationclick', (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      event.notification.close();
      event.waitUntil(PushNotificationWorker.open(scope, event.notification?.data?.link));
    });
  }

  /** The page `link` names, inside `scopeUrl` — or the scope itself for anything else. */
  static target(link: unknown, scopeUrl: string): string {
    const scope = new URL(scopeUrl);
    try {
      const url = new URL(String(link ?? '').replace(/^\/+/, ''), scope);
      return url.origin === scope.origin && url.pathname.startsWith(scope.pathname) ? url.href : scope.href;
    } catch {
      return scope.href;
    }
  }

  private static show(scope: any, event: any): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
    let message: Record<string, unknown> = {};
    try {
      message = event.data?.json() ?? {};
    } catch {
      message = {};
    }
    return scope.registration.showNotification(String(message.title ?? ''), {
      body: String(message.body ?? ''),
      data: { link: String(message.link ?? '') },
    });
  }

  private static async open(scope: any, link: unknown): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const url = PushNotificationWorker.target(link, scope.registration.scope);
    const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client: any) => client.url === url); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (open) await open.focus();
    else await scope.clients.openWindow(url);
  }
}
