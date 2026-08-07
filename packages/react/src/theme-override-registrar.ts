import React from 'react';
import { ContextBridge } from '@react/context-bridge';
import type { IBlockRendererLoader } from '@react/interfaces/block-renderer-loader.interface';

export class ThemeOverrideRegistrar {
  private static readonly BASE_PRIORITY = 11;
  private static readonly OVERRIDE_PRIORITY = 30;

  static register(
    slots: Record<string, () => Promise<{ default: React.ComponentType<any> }>>,
    themeSlug: string,
    priority = 11,
  ): void {
    for (const [slotKey, loader] of Object.entries(slots)) {
      const Lazy = React.lazy(loader);
      // The RAW loader rides along as a fifth argument. The browser reducer takes four and ignores it;
      // a SERVER render needs it, because `renderToStaticMarkup` cannot resolve `React.lazy` — it emits
      // the Suspense fallback instead of the renderer, which for the home hero is the LCP element. The
      // server registry awaits these loaders once and registers the resolved component in place.
      ContextBridge.registerOverride(slotKey, ThemeOverrideRegistrar.withSuspense(Lazy), themeSlug, priority, loader);
    }
  }

  /**
   * Single entry point. The framework owns NO plugin knowledge here — the caller supplies the
   * `slotPrefix` (the rendering host's block-slot namespace), which is data, not a framework constant.
   * The theme passes ONE flat `import.meta.glob` of its renderer roots and lists nothing per-override.
   * Renderers are discovered by a SLUG-FREE convention:
   *  - A file is a block renderer IFF its path contains a `/blocks/` segment. Everything else in
   *    the glob (sub-components, page overrides) lives outside `blocks/` and is imported directly.
   *  - Block type = filename minus a trailing `-renderer`. The FILENAME IS THE TYPE, exactly — the
   *    same string the page stores and the plugin registry declares. There is no mapping step.
   *  - Slot key = `${slotPrefix}${type}`.
   *  - Priority: a file under an `/overrides/` segment overrides a plugin-provided renderer
   *    (`OVERRIDE_PRIORITY`); otherwise it is one of the theme's own blocks (`BASE_PRIORITY`).
   * Drop a renderer into any `blocks/` directory and it registers itself — no framework/theme edit.
   *
   * A `blockTypeAliases` parameter used to normalize `rawType` here, plus a loop that registered every
   * alias against the canonical slot. Its only caller stopped passing a map once block ids were made to
   * agree across storage, registry, definition and filename, which left a parameter nothing wrote — so
   * it is gone. If two names for one block ever seem necessary again, rename the block instead.
   */
  static registerThemeBlockRenderers(
    themeSlug: string,
    modules: Record<string, () => Promise<unknown>>,
    slotPrefix: string,
  ): void {
    const prefix = String(slotPrefix || '');
    if (!prefix) return;
    const base: Record<string, IBlockRendererLoader> = {};
    const overrides: Record<string, IBlockRendererLoader> = {};

    for (const [path, loader] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
      if (!/(?:^|\/)blocks\//.test(path)) continue;
      const name = (path.split('/').pop() || '').replace(/\.tsx$/, '');
      if (!name || name.startsWith('_')) continue;
      const type = name.replace(/-renderer$/, '');
      const bucket = path.includes('/overrides/') ? overrides : base;
      bucket[`${prefix}${type}`] = ThemeOverrideRegistrar.normalizeLoader(loader);
    }

    if (Object.keys(base).length > 0) {
      ThemeOverrideRegistrar.register(base, themeSlug, ThemeOverrideRegistrar.BASE_PRIORITY);
    }
    if (Object.keys(overrides).length > 0) {
      ThemeOverrideRegistrar.register(overrides, themeSlug, ThemeOverrideRegistrar.OVERRIDE_PRIORITY);
    }
  }

  /**
   * Renderer modules export their component as a NAMED export, but `React.lazy` needs a `default`.
   * Resolve to the component — explicit `default`, then a PascalCase function, then any function.
   */
  private static normalizeLoader(loader: () => Promise<unknown>): IBlockRendererLoader {
    return () =>
      loader().then((mod) => {
        const record = (mod ?? {}) as Record<string, unknown>;
        const values = Object.values(record);
        const component =
          record.default ||
          values.find((v) => typeof v === 'function' && /^[A-Z]/.test((v as { name?: string }).name || '')) ||
          values.find((v) => typeof v === 'function');
        return { default: component as React.ComponentType<any> };
      });
  }

  private static withSuspense(Component: React.ComponentType<any>): React.ComponentType<any> {
    return function SuspenseWrapper(props: any) {
      return React.createElement(React.Suspense, { fallback: null }, React.createElement(Component, props));
    };
  }
}
