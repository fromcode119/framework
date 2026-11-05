/**
 * Resolves once the runtime import map is in the document. Theme and plugin bundles import bare
 * specifiers (`react`, `@fromcode119/sdk`, …) that only the map resolves, and a specifier resolved
 * before the map exists fails for good — so a bundle is imported only after this settles.
 *
 * The map is written by the runtime bridge (`ImportMapInstaller`), which signals `READY_EVENT`.
 */
export class RuntimeImportMapReadiness {
  static readonly SCRIPT_ID = 'fc-runtime-import-map';
  static readonly READY_EVENT = 'fromcode:import-map-ready';

  static isPublished(): boolean {
    return !!document.getElementById(RuntimeImportMapReadiness.SCRIPT_ID)?.textContent;
  }

  static whenPublished(): Promise<void> {
    if (RuntimeImportMapReadiness.isPublished()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      window.addEventListener(RuntimeImportMapReadiness.READY_EVENT, () => resolve(), { once: true });
    });
  }
}
