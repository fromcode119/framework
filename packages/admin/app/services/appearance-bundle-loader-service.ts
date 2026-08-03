import { Platform } from '@fromcode119/reactor';
import { AppPathConstants } from '@fromcode119/core/client';
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
    if (!Platform.isBrowser) return;
    const linkId = `fc-appearance-css-${id}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    // Cache-bust per full page load so a rebuilt appearance CSS is always fetched fresh (never stale).
    link.href = `${origin}${AppPathConstants.ADMIN.APPEARANCES.UI_STYLESHEET(id)}?v=${Date.now()}`;
    document.head.appendChild(link);
  }

  /**
   * Loads (and self-registers) the appearance bundle. Retries a couple of times with a short backoff so a
   * transient fetch/parse failure self-heals instead of silently falling through to the default admin.
   * Returns whether the appearance ended up registered — the caller uses this to fail CLOSED (a contained
   * "workspace unavailable" screen) rather than fail OPEN (leaking the full default console) when a non-default
   * appearance can't load. `true` for the built-in default (nothing to load) or an already-registered id.
   */
  static async ensureLoaded(id: string): Promise<boolean> {
    const desired = (id || '').trim();
    if (!desired || desired === 'default') return true;
    if (AdminAppearanceRegistry.shared.has(desired) || AppearanceBundleLoaderService.loaded.has(desired)) return true;
    await GlobalReadinessService.waitForReady();
    const origin = Platform.isBrowser ? window.location.origin : '';
    // Inject the appearance's own compiled CSS (LESS → dist/appearance.css), then load its bundle.
    AppearanceBundleLoaderService.injectStylesheet(origin, desired);
    const attempts = 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const url = `${origin}${AppPathConstants.ADMIN.APPEARANCES.UI_BUNDLE(desired)}?v=${Date.now()}-${attempt}`;
      try {
        await import(/* webpackIgnore: true */ url);
      } catch (error) {
        console.warn(`[appearance] failed to load bundle for '${desired}' (attempt ${attempt}/${attempts}):`, error);
      }
      // A bundle can import cleanly yet not register (bad build) — treat "registered" as the real success.
      if (AdminAppearanceRegistry.shared.has(desired)) {
        AppearanceBundleLoaderService.loaded.add(desired);
        return true;
      }
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return AdminAppearanceRegistry.shared.has(desired);
  }
}
