import { RuntimeRegistryAccess } from '@fromcode119/core/client';
import type { ComponentType } from 'react';
import { LucideLazyLoader } from '@react/icons/lucide-lazy-loader';

/**
 * Global Icon Registry for the framework.
 * This allows multiple icon libraries (Lucide, FontAwesome, etc.)
 * to register themselves and be accessible via a unified getIcon() call.
 */
export class IconRegistry {
  private providers: Record<string, any> = {};
  private cache: Map<string, ComponentType<any>> = new Map();

  /**
   * Register a new icon provider (e.g. window.Lucide)
   */
  registerProvider(name: string, provider: Record<string, any>) {
    this.providers[name] = provider;
    this.cache.clear(); // Clear cache when new providers are added
  }

  /**
   * Get an icon component by name, searching across all registered providers
   */
  getIcon(name: string): ComponentType<any> | null {
    if (!name) return null;
    if (this.cache.has(name)) return this.cache.get(name)!;

    // Normalize name to PascalCase for searching providers like Lucide
    const pascalName = name.charAt(0).toUpperCase() + name.slice(1);

    // 1. Search in the host app's raw FrameworkIcons, published on the runtime registry bridge
    //    (the RAW set — not the lucide proxy — so this never recurses back into getIcon).
    const bridge = (window as any)?.[RuntimeRegistryAccess.globalName]?.[RuntimeRegistryAccess.KEYS.REACT_BRIDGE];
    const frameworkIcons = bridge?.FrameworkIcons;
    if (frameworkIcons) {
      const hostIcon =
        IconRegistry.realComponent(frameworkIcons[name]) ?? IconRegistry.realComponent(frameworkIcons[pascalName]);
      if (hostIcon) return hostIcon;
    }

    // 2. Search in registered providers (e.g. the admin's eagerly-bundled namespace)
    for (const provider of Object.values(this.providers)) {
      const providerIcon =
        IconRegistry.realComponent(provider[name]) ?? IconRegistry.realComponent(provider[pascalName]);
      if (providerIcon) {
        this.cache.set(name, providerIcon);
        return providerIcon;
      }
    }

    // 3. Lucide, resolved on demand. Returns null until the icon's chunk lands,
    //    then notifies subscribers so proxy components re-render. Deliberately
    //    not cached here — the loader owns that cache, and this call is what
    //    kicks off the fetch on a miss.
    const lucideIcon = LucideLazyLoader.get(name) ?? LucideLazyLoader.get(pascalName);
    if (lucideIcon) return lucideIcon;

    // 4. Fallback to global window objects (legacy/bridge support)
    const fa = (window as any).FontAwesome;
    if (fa) {
      const faIcon = IconRegistry.realComponent(fa[name]) ?? IconRegistry.realComponent(fa[pascalName]);
      if (faIcon) return faIcon;
    }

    return null;
  }

  /**
   * Filters out proxy icons so a lookup can never resolve to a component that
   * would re-enter this method for the same name.
   *
   * `FrameworkIcons.*` and `window.Lucide.*` are proxies that delegate back to
   * getIcon() at render time; returning one here would recurse forever. Only a
   * genuine component (a real host override, an eagerly-bundled namespace)
   * satisfies a lookup.
   */
  private static realComponent(candidate: any): ComponentType<any> | null {
    if (!candidate) return null;
    if (candidate.__fcProxyIcon) return null;
    return candidate as ComponentType<any>;
  }
}
