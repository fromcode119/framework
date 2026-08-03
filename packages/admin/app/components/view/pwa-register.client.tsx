import type { ReactNode } from 'react';
import { Reactor, Platform, bound } from '@fromcode119/reactor';
import { AdminServiceWorkerConstants } from '@/lib/pwa/constants/admin-service-worker.constants';

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
    navigator.serviceWorker.register(AdminServiceWorkerConstants.SCRIPT_PATH).catch(() => { /* ignore */ });
  }

  render(): ReactNode {
    return null;
  }
}
