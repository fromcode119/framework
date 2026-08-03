/// <reference path="./lucide-dynamic-icon-imports.d.ts" />
import type React from 'react';
import dynamicIconImports from 'lucide-react/dist/esm/dynamicIconImports.js';

/**
 * On-demand resolver for the Lucide icon set.
 *
 * Why this exists
 * ---------------
 * The framework must let a *runtime-installed, previously-unknown* plugin import
 * ANY Lucide icon by name (the import map at `helpers/import-map-installer.ts`
 * enumerates `Object.keys(window.Lucide)` to emit one `export const` per icon).
 * Satisfying that by statically importing the whole namespace shipped ~924KB raw
 * / ~230KB gz of icon path data on every page — including the storefront, which
 * renders a handful of icons at most.
 *
 * The insight: the *names* are cheap, the *implementations* are expensive.
 * lucide-react's own `dynamicIconImports` table is ~13KB gz and holds every icon
 * name plus a per-icon lazy import thunk. From its 1,914 kebab keys this class
 * reconstructs the complete public export surface — verified as an exact set
 * match (5,730 names, 0 missing, 0 extra) against `import * as Lucide`:
 *
 *   'chevron-down' -> ChevronDown, ChevronDownIcon, LucideChevronDown
 *
 * So the full name surface is preserved byte-for-byte while each icon's ~450b
 * implementation loads only if something actually renders it. No allowlist, no
 * build-time enumeration of installed plugins, no behaviour change for callers.
 */
export class LucideLazyLoader {
  private static readonly thunks: Record<string, () => Promise<{ default: unknown }>> = dynamicIconImports;
  private static readonly resolved = new Map<string, React.ComponentType<any>>();
  private static readonly inFlight = new Set<string>();
  private static readonly listeners = new Set<() => void>();
  private static nameToKebabCache: Map<string, string> | null = null;
  private static revision = 0;

  /**
   * Every public icon export name (base + `…Icon` + `Lucide…` alias forms).
   * Matches `Object.keys(await import('lucide-react'))` minus the four non-icon
   * exports (`Icon`, `createLucideIcon`, `icons`, `module.exports`).
   */
  static iconNames(): string[] {
    return Array.from(LucideLazyLoader.nameIndex().keys());
  }

  /** True when `name` is a known Lucide icon export (any alias form). */
  static has(name: string): boolean {
    return LucideLazyLoader.nameIndex().has(name);
  }

  /**
   * Synchronously returns the icon component if already loaded. Otherwise starts
   * loading it and returns null — callers re-render via {@link subscribe}.
   */
  static get(name: string): React.ComponentType<any> | null {
    const kebab = LucideLazyLoader.nameIndex().get(name);
    if (!kebab) return null;

    const existing = LucideLazyLoader.resolved.get(kebab);
    if (existing) return existing;

    LucideLazyLoader.request(kebab);
    return null;
  }

  /** Subscribe to load completions. Returns an unsubscribe function. */
  static subscribe(listener: () => void): () => void {
    LucideLazyLoader.listeners.add(listener);
    return () => {
      LucideLazyLoader.listeners.delete(listener);
    };
  }

  /** Monotonic counter, bumped on every successful load. For useSyncExternalStore. */
  static getRevision(): number {
    return LucideLazyLoader.revision;
  }

  private static request(kebab: string): void {
    if (LucideLazyLoader.inFlight.has(kebab)) return;
    const thunk = LucideLazyLoader.thunks[kebab];
    if (!thunk) return;

    LucideLazyLoader.inFlight.add(kebab);
    thunk()
      .then((mod) => {
        const component = (mod?.default ?? mod) as React.ComponentType<any>;
        if (component) {
          LucideLazyLoader.resolved.set(kebab, component);
          LucideLazyLoader.revision += 1;
          LucideLazyLoader.listeners.forEach((listener) => listener());
        }
      })
      .catch(() => {
        // Allow a later render to retry a transient chunk-load failure.
        LucideLazyLoader.inFlight.delete(kebab);
      });
  }

  /** Lazily-built map of every export name (all alias forms) -> kebab thunk key. */
  private static nameIndex(): Map<string, string> {
    if (LucideLazyLoader.nameToKebabCache) return LucideLazyLoader.nameToKebabCache;

    const index = new Map<string, string>();
    Object.keys(LucideLazyLoader.thunks).forEach((kebab) => {
      const pascal = LucideLazyLoader.toPascalCase(kebab);
      index.set(pascal, kebab);
      index.set(`${pascal}Icon`, kebab);
      index.set(`Lucide${pascal}`, kebab);
    });

    LucideLazyLoader.nameToKebabCache = index;
    return index;
  }

  private static toPascalCase(kebab: string): string {
    return kebab
      .split('-')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('');
  }
}
