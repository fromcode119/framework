/**
 * The files a scaffolded theme starts life with.
 *
 * Templates in code rather than fixtures on disk: the CLI ships as a bundle, so `theme create` has to
 * work from an installed package with no source tree beside it.
 *
 * They live in their own class because a template is string DATA that happens to contain code. Inline
 * in the command, the scaffold's own `export class ThemeBoot` reads as a second class in that file to
 * everything that looks at it — this repository's guards included — and the file was measured, and
 * nearly split, at a boundary that was inside a string literal.
 */
export class ThemeScaffoldFiles {
  /** `src/styles/theme.css` — the custom properties a theme's own stylesheet builds on. */
  static css(colors: { primary: string; secondary: string }): string {
    return `
:root {
  --primary: ${colors.primary};
  --secondary: ${colors.secondary};
}
`.trim() + '\n';
  }

  /** `src/theme-boot.ts` — everything the theme does when it boots. */
  static themeBoot(slug: string): string {
    return `
/**
 * Everything this theme does when it boots. The generated entry (\`theme-entry.generated.jsx\`) hands in
 * the component maps built from theme.json's "build.components" / "build.eagerComponents" globs — both
 * empty until this theme declares real layouts or block renderers there.
 */
export class ThemeBoot {
  static start(renderers: Record<string, () => Promise<unknown>>, eagerRenderers: Record<string, unknown>): void {
    // Nothing declared yet. Once "build" lists layout/renderer globs, register them here — e.g.
    // \`ThemeOverrideRegistrar.registerThemeBlockRenderers('${slug}', { ...renderers, ...eagerRenderers }, '${slug}.')\`
    // for CMS block renderers, and \`ContextBridge.registerTheme('${slug}', { layouts, defaultLayout })\`
    // once real layout components exist (see \`themes/fromcode/src/theme-boot.ts\` for a worked example).
    void renderers;
    void eagerRenderers;
  }
}
`.trim() + '\n';
  }
}
