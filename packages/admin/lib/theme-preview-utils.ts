import { AdminUrlUtils } from '@/lib/url-utils';

/**
 * Utilities for theme preview rendering.
 *
 * `resolvePreviewPalette` used to live here. It mapped six fixed role names (`primary`, `background`,
 * `foreground`, `muted`, `card`, `accent`) onto theme variables of the SAME name and, when a lookup
 * missed, fell back to a hardcoded hex — `#6366f1` for primary, plus a dark/light map for the rest. No
 * installed theme names its variables that way, so the card rendered a palette no admin field produced.
 * Roles are gone; the preview now reads the theme's own colour variables (see `ThemePreviewSwatch`).
 */
export class ThemePreviewUtils {
  /**
   * Where a theme's "Open Site" link goes.
   *
   * The theme's own configured URL wins — an operator set it. Then the bound site's storefront, from its
   * declared hosts: without it, a theme with no URL of its own opened the CONSOLE, because the fallback
   * guesses from the console's hostname. Then the theme's declared default and the settings chain, as
   * before.
   * @param rawValue - The theme's configured URL (the operator's)
   * @param fallbackValue - The theme's declared default URL
   * @param settings - Global settings object
   * @param siteStorefrontUrl - The bound site's own address, '' in the platform scope
   * @returns Resolved frontend URL
   * @example
   * const url = ThemePreviewUtils.normalizePreviewUrl(
   *   'https://example.com',
   *   'https://fallback.com',
   *   settings
   * );
   */
  static normalizePreviewUrl(
    rawValue: unknown,
    fallbackValue: unknown,
    settings?: Record<string, unknown> | null,
    siteStorefrontUrl: string = '',
  ): string {
    if (!String(rawValue ?? '').trim() && siteStorefrontUrl) return AdminUrlUtils.resolvePreviewBaseUrl(settings, siteStorefrontUrl);
    const fallback = AdminUrlUtils.resolveFrontendBaseUrl(
      settings,
      undefined,
      String(fallbackValue || '')
    );
    return AdminUrlUtils.resolveFrontendBaseUrl(settings, rawValue, fallback);
  }
}
