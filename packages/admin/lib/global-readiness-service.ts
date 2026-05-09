import { RuntimeConstants } from '@fromcode119/core/client';

export class GlobalReadinessService {
  private static readonly MAX_POLLS = 100;
  private static readonly POLL_INTERVAL_MS = 50;

  private static resolveAdminModule(): any {
    const registry = (window as any)?.[RuntimeConstants.GLOBALS.MODULES] || {};
    return registry[RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] || registry[RuntimeConstants.MODULE_NAMES.ADMIN] || null;
  }

  static isReady(): boolean {
    const mod = GlobalReadinessService.resolveAdminModule();
    return !!(
      (window as any).FrameworkIcons &&
      (window as any).React &&
      (window as any).Lucide &&
      (window as any).Fromcode &&
      mod &&
      typeof mod.Select !== 'undefined' &&
      document.getElementById('fc-runtime-import-map') &&
      (window as any).__fromcodeRuntimeModules?.['@fromcode119/react']
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
