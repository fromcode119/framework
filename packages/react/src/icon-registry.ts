import React from 'react';

/**
 * Global Icon Registry for the framework.
 * This allows multiple icon libraries (Lucide, FontAwesome, etc.)
 * to register themselves and be accessible via a unified getIcon() call.
 */
export class IconRegistry {
  private providers: Record<string, any> = {};
  private cache: Map<string, React.ComponentType<any>> = new Map();

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
  getIcon(name: string): React.ComponentType<any> | null {
    if (!name) return null;
    if (this.cache.has(name)) return this.cache.get(name)!;

    // Normalize name to PascalCase for searching providers like Lucide
    const pascalName = name.charAt(0).toUpperCase() + name.slice(1);

    // 1. Search in explicit FrameworkIcons (Host apps)
    const frameworkIcons = (window as any).FrameworkIcons;
    if (frameworkIcons && (frameworkIcons[name] || frameworkIcons[pascalName])) {
      return frameworkIcons[name] || frameworkIcons[pascalName];
    }

    // 2. Search in registered providers
    for (const provider of Object.values(this.providers)) {
      if (provider[name]) {
        this.cache.set(name, provider[name]);
        return provider[name];
      }
      if (provider[pascalName]) {
        this.cache.set(name, provider[pascalName]);
        return provider[pascalName];
      }
    }

    // 3. Fallback to global window objects (legacy/bridge support)
    const lucide = (window as any).Lucide;
    if (lucide && (lucide[name] || lucide[pascalName])) return lucide[name] || lucide[pascalName];

    const fa = (window as any).FontAwesome;
    if (fa && (fa[name] || fa[pascalName])) return fa[name] || fa[pascalName];

    return null;
  }
}
