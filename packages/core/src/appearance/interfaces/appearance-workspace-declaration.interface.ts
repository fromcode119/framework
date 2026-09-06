/**
 * What an appearance declares when it is a PRODUCT's console — the workspace it stands up: the plugins
 * that product runs. Lives in the appearance's own `appearance.json`, never in the framework, which
 * names no plugin, theme or appearance. A workspace created from it is locked to this appearance.
 */
export interface IAppearanceWorkspaceDeclaration {
  /** Shown on the "New site" form as the preset's name; the appearance's name when absent. */
  label?: string;
  description?: string;
  /** Plugin slugs the workspace starts with; ones not installed are reported at creation, never skipped. */
  plugins: string[];
}
