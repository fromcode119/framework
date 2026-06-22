import type React from 'react';

/**
 * Registry of UI primitives an admin appearance can override. Holds a default set (today's admin
 * components) plus per-appearance override maps. `resolve` returns the appearance's override for a
 * primitive, else the default, else undefined. A shared singleton is exposed as
 * AdminComponentRegistry.shared; tests construct fresh instances for isolation.
 */
export class AdminComponentRegistry {
  static readonly shared = new AdminComponentRegistry();

  private readonly defaults = new Map<string, React.ComponentType<any>>();
  private readonly overrides = new Map<string, Map<string, React.ComponentType<any>>>();

  registerDefault(name: string, component: React.ComponentType<any>): void {
    this.defaults.set(name, component);
  }

  registerForAppearance(appearanceId: string, name: string, component: React.ComponentType<any>): void {
    let map = this.overrides.get(appearanceId);
    if (!map) {
      map = new Map<string, React.ComponentType<any>>();
      this.overrides.set(appearanceId, map);
    }
    map.set(name, component);
  }

  resolve(appearanceId: string, name: string): React.ComponentType<any> | undefined {
    return this.overrides.get(appearanceId)?.get(name) ?? this.defaults.get(name);
  }
}
