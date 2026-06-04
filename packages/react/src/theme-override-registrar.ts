import React from 'react';
import { ContextBridge } from './context-bridge';

type BlockRendererLoader = () => Promise<{ default: React.ComponentType<any> }>;

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
      ContextBridge.registerOverride(slotKey, ThemeOverrideRegistrar.withSuspense(Lazy), themeSlug, priority);
    }
  }

  /**
   * Single entry point. The framework owns NO plugin knowledge here — the caller supplies the
   * `slotPrefix` (the rendering host's block-slot namespace) and `blockTypeAliases`; both are data,
   * not framework constants. The theme passes ONE flat `import.meta.glob` of its renderer roots and
   * lists nothing per-override. Renderers are discovered by a SLUG-FREE convention:
   *  - A file is a block renderer IFF its path contains a `/blocks/` segment. Everything else in
   *    the glob (sub-components, page overrides) lives outside `blocks/` and is imported directly.
   *  - Block type = filename minus a trailing `-renderer`, normalized through `blockTypeAliases`
   *    (e.g. `rich-content` → `richContent`); unknown types pass through.
   *  - Slot key = `${slotPrefix}${type}`.
   *  - Priority: a file under an `/overrides/` segment overrides a plugin-provided renderer
   *    (`OVERRIDE_PRIORITY`); otherwise it is one of the theme's own blocks (`BASE_PRIORITY`).
   * Drop a renderer into any `blocks/` directory and it registers itself — no framework/theme edit.
   */
  static registerThemeBlockRenderers(
    themeSlug: string,
    modules: Record<string, () => Promise<unknown>>,
    slotPrefix: string,
    blockTypeAliases: Record<string, string> = {},
  ): void {
    const prefix = String(slotPrefix || '');
    if (!prefix) return;
    const base: Record<string, BlockRendererLoader> = {};
    const overrides: Record<string, BlockRendererLoader> = {};

    for (const [path, loader] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
      if (!/(?:^|\/)blocks\//.test(path)) continue;
      const name = (path.split('/').pop() || '').replace(/\.tsx$/, '');
      if (!name || name.startsWith('_')) continue;
      const rawType = name.replace(/-renderer$/, '');
      const canonical = blockTypeAliases[rawType] || rawType;
      const bucket = path.includes('/overrides/') ? overrides : base;
      bucket[`${prefix}${canonical}`] = ThemeOverrideRegistrar.normalizeLoader(loader);
    }

    // Expand each alias to its canonical slot so blocks stored under any legacy/kebab type resolve.
    for (const [alias, canonical] of Object.entries(blockTypeAliases)) {
      if (alias === canonical) continue;
      for (const bucket of [base, overrides]) {
        const canonicalSlot = bucket[`${prefix}${canonical}`];
        if (canonicalSlot && !bucket[`${prefix}${alias}`]) bucket[`${prefix}${alias}`] = canonicalSlot;
      }
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
  private static normalizeLoader(loader: () => Promise<unknown>): BlockRendererLoader {
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
