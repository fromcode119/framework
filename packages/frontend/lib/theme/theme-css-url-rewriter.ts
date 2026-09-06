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
        return `url(${quote}${new URL(target, stylesheetUrl).href}${quote})`;
      } catch {
        return match;
      }
    });
  }

  private static isRelative(reference: string): boolean {
    if (!reference) return false;
    if (reference.startsWith('/') || reference.startsWith('#')) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) return false; // http:, https:, data:, blob:
    return true;
  }
}
