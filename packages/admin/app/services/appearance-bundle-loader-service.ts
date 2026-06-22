import { AdminAppearanceRegistry } from '@/lib/appearance/admin-appearance-registry';
import { GlobalReadinessService } from '@/lib/global-readiness-service';

/**
 * Loads an external appearance's runtime bundle (served from the mounted appearance dir at
 * `/appearances/<id>/ui/bundle.js`). Importing the bundle self-registers the appearance into the
 * engine (its index.ts calls register). No-op for the built-in default or an already-loaded id.
 * The bundle's `@fromcode119/admin` imports resolve via the admin import map, so we wait for runtime
 * readiness first.
 */
export class AppearanceBundleLoaderService {
  private static readonly loaded = new Set<string>();

  static needsLoad(id: string): boolean {
    const desired = (id || '').trim();
    if (!desired || desired === 'default') return false;
    return !AdminAppearanceRegistry.shared.has(desired) && !AppearanceBundleLoaderService.loaded.has(desired);
  }

  private static injectStylesheet(origin: string, id: string): void {
    if (typeof document === 'undefined') return;
    const linkId = `fc-appearance-css-${id}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `${origin}/appearances/${encodeURIComponent(id)}/ui/appearance.css`;
    document.head.appendChild(link);
  }

  static async ensureLoaded(id: string): Promise<void> {
    const desired = (id || '').trim();
    if (!AppearanceBundleLoaderService.needsLoad(desired)) return;
    await GlobalReadinessService.waitForReady();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // Inject the appearance's own compiled CSS (LESS → dist/appearance.css), then load its bundle.
    AppearanceBundleLoaderService.injectStylesheet(origin, desired);
    const url = `${origin}/appearances/${encodeURIComponent(desired)}/ui/bundle.js`;
    try {
      await import(/* webpackIgnore: true */ url);
      AppearanceBundleLoaderService.loaded.add(desired);
    } catch (error) {
      console.warn(`[appearance] failed to load bundle for '${desired}':`, error);
    }
  }
}
