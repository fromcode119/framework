import { ThemeSsrStyleGroup } from '@/lib/ssr/theme-ssr-style-group';
import { ThemeSsrPluginStyle } from '@/lib/ssr/theme-ssr-plugin-style';
import type { IThemeSsrMarkupParts } from '@/lib/ssr/interfaces/theme-ssr-markup-parts.interface';

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
 * - **plugin DEFAULT stylesheets** (`<style data-fc-plugin-default="…">`). See {@link ThemeSsrPluginStyle}:
 *   left in the body they land after the theme's stylesheet and beat the theme's own brand rules until
 *   hydration, so the page re-styles itself mid-load.
 */
export class ThemeSsrMarkup {
  /** Body markup with the head-bound tags removed. */
  readonly bodyHtml: string;

  /** Emotion styles, grouped by cache key in first-appearance order. */
  readonly styleGroups: ThemeSsrStyleGroup[];

  /** `href`s the theme asked to preload as images. */
  readonly imagePreloads: string[];

  /** Plugin default stylesheets, deduped by key in first-appearance order. */
  readonly pluginStyles: ThemeSsrPluginStyle[];

  /**
   * True when the page body was rendered by a plugin's `frontend.content.display` slot.
   *
   * The client must NOT swap this markup out for its own tree until that slot is registered in the
   * browser too — the theme registers first and the plugin bundles land after it, so swapping on the
   * layout alone would blank the page body for a beat. That is a scored layout shift.
   */
  readonly rendersContentSlot: boolean;

  /** Plugins whose slot/override components this render mounted (`PluginUsageTracker`), sorted. */
  readonly usedPlugins: string[];

  private constructor(
    bodyHtml: string,
    styleGroups: ThemeSsrStyleGroup[],
    imagePreloads: string[],
    pluginStyles: ThemeSsrPluginStyle[],
    rendersContentSlot: boolean,
    usedPlugins: string[] = [],
  ) {
    this.bodyHtml = bodyHtml;
    this.styleGroups = styleGroups;
    this.imagePreloads = imagePreloads;
    this.pluginStyles = pluginStyles;
    this.rendersContentSlot = rendersContentSlot;
    this.usedPlugins = usedPlugins;
  }

  private static readonly STYLE_TAG = /<style data-emotion="([^"]*)"[^>]*>([\s\S]*?)<\/style>/g;

  private static readonly IMAGE_PRELOAD_TAG = /<link rel="preload"[^>]*as="image"[^>]*\/?>/g;

  private static readonly PLUGIN_STYLE_TAG = /<style data-fc-plugin-default="([^"]*)"[^>]*>([\s\S]*?)<\/style>/g;

  private static readonly HREF_ATTRIBUTE = /href="([^"]*)"/;

  static from(html: string, rendersContentSlot = false, usedPlugins: string[] = []): ThemeSsrMarkup {
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

    const pluginStyles: ThemeSsrPluginStyle[] = [];
    const seenPluginKeys = new Set<string>();
    const withoutPluginStyles = withoutStyles.replace(ThemeSsrMarkup.PLUGIN_STYLE_TAG, (_match, key, css) => {
      const styleKey = String(key || '').trim();
      // A page can render the same block twice; the sheet is the same sheet either way.
      if (styleKey && !seenPluginKeys.has(styleKey)) {
        seenPluginKeys.add(styleKey);
        pluginStyles.push(new ThemeSsrPluginStyle(styleKey, String(css || '')));
      }
      return '';
    });

    const imagePreloads: string[] = [];
    const bodyHtml = withoutPluginStyles.replace(ThemeSsrMarkup.IMAGE_PRELOAD_TAG, (match) => {
      // The href is lifted out of serialized HTML, so it is attribute-ESCAPED (`&amp;w=1400`). It is
      // rendered again as a React attribute, which escapes once more — without decoding here the head
      // carried `&amp;amp;w=` and the browser preloaded a third, different URL (the optimizer read
      // `amp;w` and served its default size), then warned the preload was never used.
      const href = ThemeSsrMarkup.decodeAttribute(match.match(ThemeSsrMarkup.HREF_ATTRIBUTE)?.[1]);
      // Two blocks preloading the same image (hero + a product card) must yield ONE head link.
      if (href && !imagePreloads.includes(href)) imagePreloads.push(href);
      return '';
    });

    return new ThemeSsrMarkup(bodyHtml, groups, imagePreloads, pluginStyles, rendersContentSlot, usedPlugins);
  }

  /** Reverses HTML attribute escaping (the five entities React emits for attribute values). */
  private static decodeAttribute(value: string | undefined): string {
    return String(value || '')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  /** True when the render produced actual markup — an empty shell is not worth shipping. */
  get hasBody(): boolean {
    return this.bodyHtml.trim().length > 0;
  }

  /** Plain data for the wire (a render host answers with this); `fromParts` is its inverse. */
  toParts(): IThemeSsrMarkupParts {
    return {
      bodyHtml: this.bodyHtml,
      styleGroups: this.styleGroups.map((group) => ({ emotionKey: group.emotionKey, names: [...group.names], css: group.css })),
      imagePreloads: [...this.imagePreloads],
      pluginStyles: this.pluginStyles.map((style) => ({ key: style.key, css: style.css })),
      rendersContentSlot: this.rendersContentSlot,
      usedPlugins: [...this.usedPlugins],
    };
  }

  static fromParts(parts: IThemeSsrMarkupParts): ThemeSsrMarkup {
    return new ThemeSsrMarkup(
      String(parts.bodyHtml || ''),
      (parts.styleGroups || []).map((group) => new ThemeSsrStyleGroup(group.emotionKey, group.names, group.css)),
      [...(parts.imagePreloads || [])],
      (parts.pluginStyles || []).map((style) => new ThemeSsrPluginStyle(style.key, style.css)),
      Boolean(parts.rendersContentSlot),
      [...(parts.usedPlugins || [])],
    );
  }
}
