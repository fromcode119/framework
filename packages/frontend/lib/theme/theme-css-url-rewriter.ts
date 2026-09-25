/**
 * When a theme stylesheet is INLINED into `<head>` its relative `url()` references (fonts, images)
 * lose the base they would have had as an external `<link>`: the browser resolves them against the
 * PAGE instead of the stylesheet, so `url(fonts/x.woff2)` 404s and every theme was forced to write the
 * versioned absolute API path into its CSS. This rewrites each relative reference against the
 * stylesheet's own public URL — exactly what the browser does for a linked stylesheet — so a theme
 * writes plain relative paths and never spells the API prefix.
 */
export class ThemeCssUrlRewriter {
  private static readonly URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

  static rewrite(css: string, stylesheetUrl: string): string {
    if (!css || !stylesheetUrl) return css;
    return css.replace(ThemeCssUrlRewriter.URL_PATTERN, (match, quote: string, reference: string) => {
      const target = reference.trim();
      if (!ThemeCssUrlRewriter.isRelative(target)) return match;
      try {
        return `url(${quote}${ThemeCssUrlRewriter.resolve(target, stylesheetUrl)}${quote})`;
      } catch {
        return match;
      }
    });
  }

  /**
   * `target` against the stylesheet's URL. The stylesheet's URL is ROOT-RELATIVE when the deployment
   * has no absolute api URL — the storefront then proxies the api on its own host, so production serves
   * `/api/v1/themes/<slug>/ui/…` with no origin. `new URL` refuses a base without one, the old code
   * caught that and left `url(fonts/x.woff2)` as it was, and every page resolved it against itself:
   * each font 404'd and the site rendered in fallbacks. A root-relative base resolves to a
   * root-relative result, which is right on whatever host serves the page.
   */
  private static resolve(target: string, stylesheetUrl: string): string {
    if (!stylesheetUrl.startsWith('/') || stylesheetUrl.startsWith('//')) return new URL(target, stylesheetUrl).href;
    const resolved = new URL(target, `${ThemeCssUrlRewriter.PLACEHOLDER_ORIGIN}${stylesheetUrl}`);
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  }

  /** Only ever used to lend a root-relative base the origin `new URL` requires; never emitted. */
  private static readonly PLACEHOLDER_ORIGIN = 'http://stylesheet.invalid';

  private static isRelative(reference: string): boolean {
    if (!reference) return false;
    if (reference.startsWith('/') || reference.startsWith('#')) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) return false; // http:, https:, data:, blob:
    return true;
  }
}
