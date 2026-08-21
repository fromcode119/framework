/**
 * One plugin's DEFAULT stylesheet, lifted out of a server-rendered page.
 *
 * A plugin ships the base design for its own blocks and injects that sheet with `head.prepend` in the
 * browser, deliberately BEFORE the theme's stylesheet: a theme then rebrands the block with plain
 * single-class rules that win the cascade tie on load order. Server-side there is no `document` to
 * prepend into, so the plugin emits the same CSS inline — and inline means the END of the document,
 * after the theme's stylesheet, which inverts that tie. The plugin's own defaults then beat the
 * theme's brand rules until the browser boots and prepends the real sheet, and the page visibly
 * re-styles itself mid-load.
 *
 * Extracting the tag here and re-emitting it as a hoistable style puts it back at the top of `<head>`,
 * where the client would have put it.
 */
export class ThemeSsrPluginStyle {
  /** Identifies the sheet, so the same plugin block rendered twice contributes one copy. */
  readonly key: string;

  readonly css: string;

  constructor(key: string, css: string) {
    this.key = key;
    this.css = css;
  }

  /** React dedupes hoisted styles by `href`; this is that identity, not a fetchable URL. */
  get href(): string {
    return `fc-plugin-default-${this.key}`;
  }
}
