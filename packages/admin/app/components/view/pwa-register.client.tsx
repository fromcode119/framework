import type { ReactNode } from 'react';
import { Reactor, Platform, bound } from '@fromcode119/reactor';
import { AdminServiceWorkerConstants } from '@/lib/pwa/constants/admin-service-worker.constants';
import { AdminPathUtils } from '@/lib/admin-path';

/**
 * Registers the admin-console service worker on the client (installability + offline shell). No UI. Silent
 * on failure — a blocked/unsupported SW must never break the app. Domain-agnostic framework capability.
 */
export class PwaRegister extends Reactor {
  componentDidMount(): void {
    if (!Platform.isBrowser || !('serviceWorker' in navigator)) return;
    if (document.readyState === 'complete') this.register();
    else this.listen(window, 'load', this.register, { once: true });
  }

  @bound register(): void {
    // SCRIPT_PATH is the worker's PUBLIC path (`/sw.js`) and is shared with the worker build, so it
    // carries no base path. The admin is served under one, so registering it raw asked for
    // `<origin>/sw.js` — a 404 ("A bad HTTP response code (404) was received when fetching the
    // script"), while the file is served at `<origin>/admin/sw.js`. The manifest <link> in
    // layout.tsx already goes through toAdminPath; this had been missed.
    // `scope` must be the admin base too, or the worker would claim the whole origin.
    const scriptUrl = AdminPathUtils.toAdminPath(AdminServiceWorkerConstants.SCRIPT_PATH);
    const scope = AdminPathUtils.toAdminPath('/');
    navigator.serviceWorker.register(scriptUrl, { scope }).catch(() => { /* ignore */ });
  }

  render(): ReactNode {
    return null;
  }
}
