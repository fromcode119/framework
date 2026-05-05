import type React from 'react';
import { LazyComponentLoaderService } from './lazy-component-loader-service';

export class LazyLoadClass {
  protected static readonly moduleImports: Record<string, () => Promise<Record<string, any>>> = {};

  /**
   * Resolves `load(['path/to/module.tsx'])` against registry keys that may use
   * `./path/...` (Vite import.meta.glob) or bare `path/...`.
   */
  protected static candidateModuleKeys(modulePath: string): string[] {
    const trimmed = String(modulePath || '').trim();
    const noLeadingDot = trimmed.replace(/^\.\//, '');
    const withDotPrefix = noLeadingDot.startsWith('./') ? noLeadingDot : `./${noLeadingDot}`;
    const deduped = new Set<string>([trimmed, noLeadingDot, withDotPrefix]);
    return Array.from(deduped);
  }

  protected static async importPath(modulePath: string): Promise<Record<string, any>> {
    const registry = this.moduleImports as Record<string, (() => Promise<Record<string, any>>) | undefined>;
    for (const key of LazyLoadClass.candidateModuleKeys(modulePath)) {
      const loadModule = registry[key];
      if (loadModule) {
        return loadModule();
      }
    }

    throw new Error(`Lazy loader path "${modulePath}" is not registered for ${this.name}.`);
  }

  protected static loadModule(
    loadModule: () => Promise<Record<string, any>>,
    options: { exportName?: string; displayName?: string; fallback?: React.ReactNode } = {},
  ): React.ComponentType<any> {
    if (options.exportName) {
      return LazyComponentLoaderService.component(loadModule, {
        exportName: options.exportName,
        displayName: options.displayName,
        fallback: options.fallback,
      });
    }

    return LazyComponentLoaderService.component(
      loadModule as unknown as () => Promise<{ default: React.ComponentType<any> }>,
      {
        displayName: options.displayName,
        fallback: options.fallback,
      },
    );
  }

  protected static load(
    pathSpec: [string],
    options: { exportName?: string; displayName?: string; fallback?: React.ReactNode } = {},
  ): React.ComponentType<any> {
    const [modulePath] = pathSpec;
    const loadModule = LazyLoadClass.resolveModuleLoader(this, modulePath);
    return LazyLoadClass.loadModule(loadModule, options);
  }

  private static resolveModuleLoader(
    owner: typeof LazyLoadClass,
    modulePath: string,
  ): () => Promise<Record<string, any>> {
    return () => owner.importPath(modulePath);
  }
}