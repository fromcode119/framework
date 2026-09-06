/**
 * The content-body contract the SERVER tree and its browser twin share: the slot names a plugin fills
 * (`ThemeSsrContentTree` / `ThemeServerRenderer` on the server, `StorefrontPageTree` / `StorefrontHydrator`
 * in the runtime, the swap-era `HomeClient` / `DynamicContentClient` on the Next path) and the classes of
 * the stored-HTML prose body both trees render for string content.
 *
 * One place on purpose: the two trees must be element-for-element identical for `hydrateRoot` to adopt
 * the server markup, and a literal restated on each side is a literal that can drift. The parity test
 * (`storefront-page-tree-parity.test.ts`) still diffs the rendered HTML; this removes the way it could
 * ever differ by a slot name or a class string. The wrapper each route renders around this body is
 * `StorefrontPageKind` (`runtime/storefront-page-kind.ts`).
 */
export class StorefrontContentContract {
  /** The 404 override chain, outermost first: the framework's, then the theme's, then `NotFoundBody`. */
  static readonly NOT_FOUND_OVERRIDES = ['framework.page.404', 'frontend.page.404'] as const;

  /** The slot a plugin fills with the page body — the content block flow, on every content page. */
  static readonly DISPLAY_SLOT = 'frontend.content.display';

  /** The slot rendered after the body (a plugin's per-page footer content). */
  static readonly FOOTER_SLOT = 'frontend.content.footer';

  /** The stored-HTML prose body's wrapper classes. */
  static readonly PROSE_CLASS = 'prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6';

  /** The stored-HTML prose body's title classes. */
  static readonly TITLE_CLASS = 'text-4xl font-black mb-8';
}
