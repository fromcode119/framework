import type React from 'react';
import type { IconNode } from 'lucide-react';
import { Platform } from '@fromcode119/react-class-components';
import { LucideIconAssetUrl } from '@react/icons/lucide-icon-asset-url';
import lucideIconNames from '@react/icons/lucide-icon-names.generated.json';
// Lucide's deep ESM entry ships no declaration file. Suppressed locally rather than papered over with
// an ambient `.d.ts`: that file had to sit in `src/`, was swallowed by the `packages/*/src/**/*.d.ts`
// ignore rule, and so never reached CI — every clean checkout failed with TS6053. The value is given
// its real, narrow type by `build` below, so nothing is left untyped.
// `@ts-ignore`, not `@ts-expect-error`: this file is compiled under BOTH react's config
// (`noImplicitAny: false` -> no error, so `expect-error` itself errors as unused, TS2578) and
// admin's (`noImplicitAny: true` -> the suppression is required). Only `ts-ignore` satisfies both.
// @ts-ignore -- untyped deep import; given its real type by `build` below.
import createLucideIcon from 'lucide-react/dist/esm/createLucideIcon.js';

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
 * From the generated list of 1,914 kebab icon keys (`lucide-icon-names.generated.json`,
 * written by `build:frontend-icons` and pinned to the installed lucide by a drift test)
 * this class reconstructs the complete public export surface — verified as an exact
 * set match (5,730 names, 0 missing, 0 extra) against `import * as Lucide`:
 *
 *   'chevron-down' -> ChevronDown, ChevronDownIcon, LucideChevronDown
 *
 * An icon's implementation is a ~300-byte DATA module (`/fc-runtime/icons/<version>/<kebab>.js`,
 * the icon's `[tag, attrs][]` node and nothing else) fetched with a native `import()` only when
 * something actually renders it, then turned into a component by the ONE `createLucideIcon` this
 * bundle carries. No allowlist, no build-time enumeration of installed plugins, no behaviour change
 * for callers — and no lucide table in any bundle: neither Next's chunk graph nor the storefront
 * runtime IIFE (which would have had to inline all 1,914 icon modules) carries an icon it does not draw.
 */
export class LucideLazyLoader {
  /** The one bundled component factory — lucide's own, so every icon renders exactly as `lucide-react` would. */
  private static readonly build: (iconName: string, iconNode: IconNode) => React.ComponentType<any> = createLucideIcon;
  private static readonly kebabNames: readonly string[] = lucideIconNames.names;
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

  /**
   * ONE native dynamic import of the icon's data module. The specifier is a runtime URL, so every
   * bundler is told to leave the call alone (Vite / webpack / Turbopack each read their own comment);
   * the browser resolves it against the current document, on this app's origin.
   */
  static fetchIconNode(kebab: string): Promise<IconNode> {
    const url = LucideIconAssetUrl.for(kebab);
    return import(/* @vite-ignore */ /* webpackIgnore: true */ /* turbopackIgnore: true */ url).then(
      (mod: { default: IconNode }) => mod.default,
    );
  }

  private static request(kebab: string): void {
    // Only a browser can fetch a public asset; on the server a proxy icon renders nothing, as before.
    if (!Platform.isBrowser) return;
    if (LucideLazyLoader.inFlight.has(kebab)) return;

    LucideLazyLoader.inFlight.add(kebab);
    LucideLazyLoader.fetchIconNode(kebab)
      .then((iconNode) => {
        if (!Array.isArray(iconNode)) return;
        LucideLazyLoader.resolved.set(kebab, LucideLazyLoader.build(kebab, iconNode));
        LucideLazyLoader.revision += 1;
        LucideLazyLoader.listeners.forEach((listener) => listener());
      })
      .catch(() => {
        // Allow a later render to retry a transient fetch failure.
        LucideLazyLoader.inFlight.delete(kebab);
      });
  }

  /** Lazily-built map of every export name (all alias forms) -> kebab key. */
  private static nameIndex(): Map<string, string> {
    if (LucideLazyLoader.nameToKebabCache) return LucideLazyLoader.nameToKebabCache;

    const index = new Map<string, string>();
    LucideLazyLoader.kebabNames.forEach((kebab) => {
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
