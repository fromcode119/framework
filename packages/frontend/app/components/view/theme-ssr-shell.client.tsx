import { PureReactor, prop } from '@fromcode119/reactor';

/**
 * Holds the server-rendered theme markup until the theme's browser bundle has registered its layouts.
 *
 * Why the markup is carried as a STRING through a client component rather than rendered by the server
 * component directly: the theme's layout components live in the SERVER's module graph (imported from
 * `ui-ssr/entry.mjs` at runtime) and can never be part of the client bundle, so the client's first
 * render cannot reproduce them. Rendering the identical string on both sides is what makes hydration
 * match — React does not descend into raw inner markup, so it accepts the subtree as-is.
 *
 * Once `themeLayouts` arrives the owning component stops rendering this and renders the real tree; by
 * then the client has the same menus, settings and translations the server rendered with, so the swap
 * produces the same markup and shifts nothing.
 *
 * The markup is `ThemeServerRenderer` output — React's own escaped rendering of the theme's
 * components, produced in this process. It is not user content and needs no sanitizing.
 */
export class ThemeSsrShell extends PureReactor {
  @prop declare html: string;

  render() {
    return <div suppressHydrationWarning {...ThemeSsrShell.inlineMarkup(this.html)} />;
  }

  /** Server-rendered, trusted markup — see the note on this class. */
  private static inlineMarkup(html: string): Record<string, unknown> {
    return { dangerouslySetInnerHTML: { __html: html } };
  }
}
