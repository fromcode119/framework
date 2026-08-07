import { Platform } from '@fromcode119/reactor';
import { RuntimeConstants, RuntimeRegistryAccess } from '@fromcode119/core/client';

/**
 * Fail-closed access to the ADMIN component surface for plugin and theme bundles.
 *
 * Why this exists at all: a plugin/theme bundle is a separate ESM graph whose externals resolve
 * through the one runtime registry. The admin seeds its component module there under several keys.
 * Reaching those keys means writing the admin package NAME, which is exactly what the SDK boundary
 * forbids a plugin or theme to do — so a theme that needed the media picker had two bad options: name
 * the package and fail `check:sdk-boundary`, or `React.lazy(() => import('…/admin'))`, which RESOLVES
 * to a module that has no `MediaPicker` on it, hands React an undefined lazy type (error #306) and
 * takes down the whole block-settings panel. Neither is a choice a theme should have to make.
 *
 * The framework owns the keys, so the framework does the lookup. Callers ask for a component by NAME
 * and get either the component or `null` — never `undefined`, never a throw, never a package name in
 * plugin/theme source. `null` means "this surface is not available here" (the storefront, SSR, a test),
 * which every caller must already render for.
 */
export class AdminComponentRegistry {
  /**
   * The registry keys the admin publishes its component module under, most specific first. They are
   * framework-internal names; nothing outside this class needs to know them.
   */
  private static get moduleKeys(): string[] {
    return [
      RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS,
      RuntimeConstants.MODULE_NAMES.ADMIN,
    ];
  }

  /** The admin component module if this bundle is running inside the admin, else null. */
  private static module(): Record<string, unknown> | null {
    if (!Platform.isBrowser) return null;
    const registry = RuntimeRegistryAccess.ensure();
    for (const key of AdminComponentRegistry.moduleKeys) {
      const candidate = registry[key];
      if (candidate) return candidate as Record<string, unknown>;
    }
    return null;
  }

  /** True when admin components can be resolved here — for rendering a different surface, not a guard. */
  static get isAvailable(): boolean {
    return AdminComponentRegistry.module() !== null;
  }

  /**
   * One admin component by name, or null. Names are the framework's own admin exports
   * (`RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS`) — `MediaPicker`, `ColorPicker`, `DataTable`, ….
   */
  static get(name: string): any {
    const adminModule = AdminComponentRegistry.module();
    if (!adminModule) return null;
    return adminModule[String(name || '').trim()] ?? null;
  }

  /**
   * The framework media picker, or null outside the admin. Named explicitly because it is the one
   * admin component themes routinely need: any block field that edits an image opens it.
   */
  static mediaPicker(): any {
    return AdminComponentRegistry.get('MediaPicker');
  }
}
