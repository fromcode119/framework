/**
 * ThemePackageLayout
 *
 * Where a BUILT theme puts its compiled output. Same rule as {@link PluginPackageLayout}: the build's
 * business, not the theme author's, so the framework owns it in ONE place instead of every theme
 * restating it — and restating it wrongly, because a theme that names its own artifact is naming a
 * `.js` file it does not have, in a directory it never edits.
 *
 * That is exactly what went wrong with the head script. `theme.json` carried
 * `"ui": { "headScript": "reveal.js" }` while the source was `src/boot/reveal.ts`, and nothing
 * anywhere stated the hop between them: the `.ts` -> `.js` rename and the `src/boot/` -> `ui/` move
 * existed only as a convention inside one bash function. Read the theme and you could not tell which
 * file it meant. So the declaration is gone and the layout is fixed, the way `index.js`,
 * `bundle.js` and `frontend.js` are fixed for plugins.
 *
 * A theme that needs something to run AT FIRST PAINT writes {@link HEAD_SCRIPT_SOURCE}. There is
 * nothing to declare, nothing to keep in sync, and one obvious file to open.
 */
export class ThemePackageLayout {
  /**
   * The head script's SOURCE, relative to the theme root — TypeScript, like everything else a theme
   * author writes. Themes ship no `.js` files at all.
   */
  static readonly HEAD_SCRIPT_SOURCE = 'src/boot/head.ts';

  /**
   * The head script's compiled ARTIFACT, relative to the theme's served `ui/` directory.
   *
   * The build emits one self-contained IIFE here and the framework inlines it into `<head>`. It has
   * no imports — not because a theme author must write it that way, but because the bundler collapses
   * whatever they wrote into a single file. Anything the SHIPPED file imported would put it back
   * behind the module chain it exists to escape, which is the whole reason the capability exists.
   */
  static readonly HEAD_SCRIPT_ARTIFACT = 'head.js';

  /**
   * The head-script artifact a theme serves, or `''` when it has none.
   *
   * An explicit `ui.headScript` still wins, exactly as an explicit manifest value wins in
   * `PluginPackageLayout.resolve` — a third-party theme built by other tooling keeps declaring its
   * own, and that stays a visible, declared value rather than something the framework guesses over.
   * First-party themes declare nothing. The cost of deriving rather than declaring is that a theme
   * with no head script is asked for one: the frontend fetches `ui/head.js`, gets a 404 and inlines
   * nothing. That fetch is internal and cached for an hour, so it is one miss per theme per hour —
   * cheaper than a declaration every theme has to keep true.
   */
  static headScriptArtifact(theme: Record<string, unknown>): string {
    const ui = theme.ui as Record<string, unknown> | undefined;
    const declared = String(ui?.headScript || '').trim();
    return declared || ThemePackageLayout.HEAD_SCRIPT_ARTIFACT;
  }
}
