import { Enum } from '@fromcode119/reactor';

/**
 * Which route produced the document, and therefore which content wrapper the server rendered around
 * the page body.
 *
 * The two content routes render the SAME tree with one difference: the home page's wrapper reserves no
 * height (the theme's layout does, `app/page.tsx`), a slug page's wrapper reserves the viewport
 * (`app/[...slug]/page.tsx`). The client twin must reproduce the exact wrapper it hydrates, so the kind
 * carries that decision instead of the runtime guessing it from the URL.
 */
export class StorefrontPageKind extends Enum {
  static readonly HOME = new StorefrontPageKind('home', 'w-full', null);

  static readonly CONTENT = new StorefrontPageKind('content', 'w-full', { minHeight: '100svh' });

  /** Nothing resolved at the path: the theme layout around the framework's 404 body (theme overrides honoured), status 404. */
  static readonly NOT_FOUND = new StorefrontPageKind('not-found', 'w-full', { minHeight: '100svh' });

  get isNotFound(): boolean {
    return this === StorefrontPageKind.NOT_FOUND;
  }

  private constructor(
    value: string,
    /** The content wrapper's class — `contentClassName` on `ThemeServerRenderer.render`. */
    readonly contentClassName: string,
    /** The content wrapper's inline style — `contentStyle` on `ThemeServerRenderer.render`. */
    readonly contentStyle: Record<string, string> | null,
  ) {
    super(value);
  }
}
