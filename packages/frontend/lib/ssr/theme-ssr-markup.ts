import { ThemeSsrStyleGroup } from '@/lib/ssr/theme-ssr-style-group';

/**
 * A server-rendered theme, split into the part that belongs in `<head>` and the part that belongs in
 * the document body.
 *
 * Two things are lifted out of the raw render:
 *
 * - **emotion `<style>` tags.** They must not stay in the body, because the body markup is thrown away
 *   the moment the theme's browser bundle registers and React takes over rendering for real. Styles
 *   that went away with it would leave the page unstyled. In `<head>` they survive the swap, land
 *   ahead of first paint, and are picked up by emotion's browser cache exactly as in a normal SSR
 *   setup.
 * - **`<link rel="preload">`.** The theme preloads its logo — the LCP element. In `<head>` the browser
 *   discovers it in the preload scanner instead of after parsing the body.
 */
export class ThemeSsrMarkup {
  /** Body markup with the head-bound tags removed. */
  readonly bodyHtml: string;

  /** Emotion styles, grouped by cache key in first-appearance order. */
  readonly styleGroups: ThemeSsrStyleGroup[];

  /** `href`s the theme asked to preload as images. */
  readonly imagePreloads: string[];

  /**
   * True when the page body was rendered by a plugin's `frontend.content.display` slot.
   *
   * The client must NOT swap this markup out for its own tree until that slot is registered in the
   * browser too — the theme registers first and the plugin bundles land after it, so swapping on the
   * layout alone would blank the page body for a beat. That is a scored layout shift.
   */
  readonly rendersContentSlot: boolean;

  private constructor(
    bodyHtml: string,
    styleGroups: ThemeSsrStyleGroup[],
    imagePreloads: string[],
    rendersContentSlot: boolean,
  ) {
    this.bodyHtml = bodyHtml;
    this.styleGroups = styleGroups;
    this.imagePreloads = imagePreloads;
    this.rendersContentSlot = rendersContentSlot;
  }

  private static readonly STYLE_TAG = /<style data-emotion="([^"]*)"[^>]*>([\s\S]*?)<\/style>/g;

  private static readonly IMAGE_PRELOAD_TAG = /<link rel="preload"[^>]*as="image"[^>]*\/?>/g;

  private static readonly HREF_ATTRIBUTE = /href="([^"]*)"/;

  static from(html: string, rendersContentSlot = false): ThemeSsrMarkup {
    const groups: ThemeSsrStyleGroup[] = [];
    const byKey = new Map<string, number>();

    const withoutStyles = String(html || '').replace(ThemeSsrMarkup.STYLE_TAG, (_match, attribute, css) => {
      const [emotionKey, ...names] = String(attribute || '').trim().split(/\s+/).filter(Boolean);
      if (!emotionKey) return '';
      const index = byKey.get(emotionKey);
      if (index === undefined) {
        byKey.set(emotionKey, groups.length);
        groups.push(new ThemeSsrStyleGroup(emotionKey, names, css));
      } else {
        groups[index] = groups[index].concat(names, css);
      }
      return '';
    });

    const imagePreloads: string[] = [];
    const bodyHtml = withoutStyles.replace(ThemeSsrMarkup.IMAGE_PRELOAD_TAG, (match) => {
      const href = match.match(ThemeSsrMarkup.HREF_ATTRIBUTE)?.[1];
      if (href) imagePreloads.push(href);
      return '';
    });

    return new ThemeSsrMarkup(bodyHtml, groups, imagePreloads, rendersContentSlot);
  }

  /** True when the render produced actual markup — an empty shell is not worth shipping. */
  get hasBody(): boolean {
    return this.bodyHtml.trim().length > 0;
  }
}
