import type React from 'react';

/**
 * Registry of admin page bodies an appearance can override, keyed by AdminPageKeys. Holds an
 * optional default per key plus per-appearance override maps; `resolve` returns the appearance's
 * override, else the default, else undefined (caller falls back to its existing page). No defaults
 * are registered yet — today's pages remain the route implementations until the Plan 3 extraction.
 * A shared singleton is exposed as AdminPageRegistry.shared; tests construct fresh instances.
 */
export class AdminPageRegistry {
  static readonly shared = new AdminPageRegistry();

  private readonly defaults = new Map<string, React.ComponentType<any>>();
  private readonly overrides = new Map<string, Map<string, React.ComponentType<any>>>();

  registerDefault(key: string, component: React.ComponentType<any>): void {
    this.defaults.set(key, component);
  }

  registerForAppearance(appearanceId: string, key: string, component: React.ComponentType<any>): void {
    let map = this.overrides.get(appearanceId);
    if (!map) {
      map = new Map<string, React.ComponentType<any>>();
      this.overrides.set(appearanceId, map);
    }
    map.set(key, component);
  }

  resolve(appearanceId: string, key: string): React.ComponentType<any> | undefined {
    return this.overrides.get(appearanceId)?.get(key) ?? this.defaults.get(key);
  }
}
