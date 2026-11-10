/**
 * Resolves once the runtime import map is in the document AND usable. Theme and plugin bundles import
 * bare specifiers (`react`, `@fromcode119/sdk`, …) that only the map resolves, and a specifier resolved
 * before the map exists fails for good — so a bundle is imported only after this settles.
 *
 * The map is written by the runtime bridge (`ImportMapInstaller`) in two steps. The `<script
 * type="importmap">` goes into the document FIRST, before the bridge starts any module load of its own:
 * Firefox, following the spec, ignores an import map inserted after a module load has begun (Chromium
 * accepts it, which is why a late map only ever broke Firefox). The map's modules read the runtime host
 * when they evaluate, so the bridge marks the map {@link READY_ATTRIBUTE} and signals {@link READY_EVENT}
 * only once the host holds every entry. "Published" means that second step.
 */
export class RuntimeImportMapReadiness {
  static readonly SCRIPT_ID = 'fc-runtime-import-map';
  static readonly READY_EVENT = 'fromcode:import-map-ready';
  /** Set on the import-map script once the runtime host it points at is filled. */
  static readonly READY_ATTRIBUTE = 'data-fc-ready';

  static isPublished(): boolean {
    const script = document.getElementById(RuntimeImportMapReadiness.SCRIPT_ID);
    return !!script?.textContent && script.hasAttribute(RuntimeImportMapReadiness.READY_ATTRIBUTE);
  }

  /** Called by the bridge once the host is connected: marks the map usable and wakes every waiter. */
  static markReady(script: HTMLScriptElement): void {
    script.setAttribute(RuntimeImportMapReadiness.READY_ATTRIBUTE, '');
    window.dispatchEvent(new CustomEvent(RuntimeImportMapReadiness.READY_EVENT));
  }

  static whenPublished(): Promise<void> {
    if (RuntimeImportMapReadiness.isPublished()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      window.addEventListener(RuntimeImportMapReadiness.READY_EVENT, () => resolve(), { once: true });
    });
  }
}
