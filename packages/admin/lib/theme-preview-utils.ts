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
   * Normalizes preview URL with fallback resolution
   * @param rawValue - Primary URL value
   * @param fallbackValue - Fallback URL if primary is empty
   * @param settings - Global settings object
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
    settings?: Record<string, unknown> | null
  ): string {
    const fallback = AdminUrlUtils.resolveFrontendBaseUrl(
      settings,
      undefined,
      String(fallbackValue || '')
    );
    return AdminUrlUtils.resolveFrontendBaseUrl(settings, rawValue, fallback);
  }
}
