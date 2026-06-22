import type { AdminAppearanceManifest } from './admin-appearance-manifest.interfaces';

/**
 * In-memory registry of selectable admin appearances. The built-in default registers at boot;
 * additional appearances (admin-appearances/<slug>/) register their manifest here. A shared singleton is
 * exposed as AdminAppearanceRegistry.shared; tests construct fresh instances for isolation.
 */
export class AdminAppearanceRegistry {
  static readonly shared = new AdminAppearanceRegistry();

  private readonly appearances = new Map<string, AdminAppearanceManifest>();

  register(manifest: AdminAppearanceManifest): void {
    this.appearances.set(manifest.id, manifest);
  }

  has(id: string): boolean {
    return this.appearances.has(id);
  }

  get(id: string): AdminAppearanceManifest | undefined {
    return this.appearances.get(id);
  }

  list(): AdminAppearanceManifest[] {
    return Array.from(this.appearances.values());
  }

  ids(): string[] {
    return Array.from(this.appearances.keys());
  }
}
