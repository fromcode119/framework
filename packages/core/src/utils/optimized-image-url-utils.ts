import { ApiPathUtils } from '@core/api';
import { PublicAssetUrlUtils } from '@core/utils/public-asset-url-utils';

/**
 * Resizing URLs for images the platform serves, when something has registered an optimizer.
 *
 * REGISTERED rather than imported, because the optimizer lives in a layer core cannot reach: core
 * hands out URLs and knows nothing about how an image is resized. With nothing registered every
 * method answers with the original URL, which is the honest fallback — an unoptimised image is
 * correct, and a URL to a resizer that does not exist is not.
 *
 * Split out of `PublicAssetUrlUtils` (322 lines), which answers where an asset IS.
 */
export class OptimizedImageUrlUtils {
  /** Set by whichever layer can actually resize. Null until then, and null is a valid state. */
  private static imageOptimizer: ((uploadPath: string, width: number, quality: number) => string) | null = null;

  static registerImageOptimizer(builder: (uploadPath: string, width: number, quality: number) => string): void {
    OptimizedImageUrlUtils.imageOptimizer = builder;
  }

  /**
   * An upload image at a target width, through the registered optimizer. Non-uploads (theme assets,
   * remote URLs, data URIs) and an unregistered optimizer both return the input unchanged — the caller
   * always gets a usable `src`.
   */
  // Default quality 80: photographic content below ~75 shows visible artifacts, and sources that
  // are themselves compressed (most uploads) degrade twice. 60 was cheap on bytes but every image
  // on the storefront paid for it.
  static optimizedUploadUrl(url: any, width: number, quality = 80): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const uploadPath = OptimizedImageUrlUtils.extractUploadPath(raw);
    if (!uploadPath || !OptimizedImageUrlUtils.imageOptimizer) return raw;
    return String(OptimizedImageUrlUtils.imageOptimizer(uploadPath, width, quality) || raw);
  }

  /**
   * A `srcset` for an upload image across `widths`, so the browser downloads the size it will display
   * instead of the full-resolution original. Empty string when the image cannot be optimized, which is
   * exactly what an `<img srcSet={...}>` should receive in that case — a srcset of identical URLs at
   * different width descriptors is worse than none, because the browser then picks by descriptor and
   * still downloads the original.
   */
  static responsiveUploadSrcSet(url: any, widths: number[], quality = 80): string {
    const raw = String(url || '').trim();
    if (!raw || !OptimizedImageUrlUtils.imageOptimizer) return '';
    if (!OptimizedImageUrlUtils.extractUploadPath(raw)) return '';

    const uniqueWidths = Array.from(new Set(
      (Array.isArray(widths) ? widths : [])
        .map((value) => Math.round(Number(value) || 0))
        .filter((value) => Number.isFinite(value) && value > 0),
    )).sort((left, right) => left - right);
    if (!uniqueWidths.length) return '';

    return uniqueWidths
      .map((width) => `${OptimizedImageUrlUtils.optimizedUploadUrl(raw, width, quality)} ${width}w`)
      .join(', ');
  }

  /**
   * The optimizable path inside a value, whether it arrived as a path or an absolute URL: an upload, or
   * a theme's own UI asset. Themes ship their own imagery and it is often the heaviest thing on a page,
   * so leaving it out would optimize only half the images on the site. Anything else (remote URL, data
   * URI, SVG) returns null and is served untouched.
   */
  static extractUploadPath(url: string): string | null {
    const pathname = OptimizedImageUrlUtils.toPathname(url);
    if (!pathname) return null;
    if (pathname.startsWith(`${PublicAssetUrlUtils.uploadBasePath}/`)) return pathname;
    // Vector art is already tiny and rasterising it would make it worse.
    if (/\.svg(\?|$)/i.test(pathname)) return null;
    // Derived from the theme-UI route template — see ApiPathUtils.themeUiAssetMatcher.
    if (ApiPathUtils.themeUiAssetMatcher().test(pathname)) return pathname;
    return null;
  }

  static toPathname(url: string): string {
    if (url.startsWith('/')) return url;
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  }
}
