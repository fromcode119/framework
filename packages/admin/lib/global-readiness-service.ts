import { RuntimeConstants, RuntimeRegistryAccess } from '@fromcode119/core/client';

export class GlobalReadinessService {
  private static readonly MAX_POLLS = 100;
  private static readonly POLL_INTERVAL_MS = 50;

  private static resolveAdminModule(): any {
    const registry = (window as any)?.[RuntimeConstants.GLOBALS.MODULES] || {};
    return registry[RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] || registry[RuntimeConstants.MODULE_NAMES.ADMIN] || null;
  }

  static isReady(): boolean {
    // Everything the admin needs lives under the ONE runtime registry — react, the lucide proxy, the
    // framework bridge, and the admin module. No bare window.React / window.Fromcode / window.Lucide.
    const registry = (window as any)?.[RuntimeConstants.GLOBALS.MODULES] || {};
    const mod = GlobalReadinessService.resolveAdminModule();
    return !!(
      registry[RuntimeRegistryAccess.KEYS.REACT] &&
      registry[RuntimeRegistryAccess.KEYS.LUCIDE] &&
      registry[RuntimeRegistryAccess.KEYS.REACT_BRIDGE] &&
      mod &&
      typeof mod.Select !== 'undefined' &&
      document.getElementById('fc-runtime-import-map')
    );
  }

  static waitForReady(signal?: AbortSignal): Promise<void> {
    if (GlobalReadinessService.isReady()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('Aborted'));

      if (!document.getElementById('fc-runtime-import-map')) {
        const observer = new MutationObserver(() => {
          if (!document.getElementById('fc-runtime-import-map')) return;
          observer.disconnect();
          GlobalReadinessService.poll(resolve, reject, signal);
        });
        observer.observe(document.head, { childList: true });
        signal?.addEventListener('abort', () => { observer.disconnect(); reject(new Error('Aborted')); }, { once: true });
        return;
      }

      GlobalReadinessService.poll(resolve, reject, signal);
    });
  }

  private static poll(resolve: () => void, reject: (e: Error) => void, signal?: AbortSignal, tick = 0): void {
    if (signal?.aborted) return reject(new Error('Aborted'));
    if (GlobalReadinessService.isReady()) return resolve();
    if (tick >= GlobalReadinessService.MAX_POLLS) {
      return reject(new Error('[Admin] Required globals not ready after timeout'));
    }
    setTimeout(() => GlobalReadinessService.poll(resolve, reject, signal, tick + 1), GlobalReadinessService.POLL_INTERVAL_MS);
  }
}
