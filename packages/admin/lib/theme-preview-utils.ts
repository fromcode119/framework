import { AdminUrlUtils } from './url-utils';

/**
 * Utilities for theme preview rendering and color palette resolution
 */
export class ThemePreviewUtils {
  /**
   * Converts any value to a non-empty trimmed string
   * @param value - Value to convert
   * @returns Non-empty string or empty string if falsy
   * @example
   * const color = ThemePreviewUtils.toNonEmptyString('#fff'); // "#fff"
   * const empty = ThemePreviewUtils.toNonEmptyString(null); // ""
   */
  static toNonEmptyString(value: unknown): string {
    return String(value ?? '').trim();
  }

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

  /**
   * Resolves theme color palette with admin theme fallbacks
   * @param params - Palette resolution parameters
   * @param params.adminTheme - Current admin theme ('dark' | 'light')
   * @param params.current - Current theme variable values
   * @param params.defaults - Default theme variable values
   * @returns Resolved color palette
   * @example
   * const palette = ThemePreviewUtils.resolvePreviewPalette({
   *   adminTheme: 'dark',
   *   current: { primary: '#6366f1' },
   *   defaults: { background: '#000' }
   * });
   * // => { primary: '#6366f1', background: '#000', ... }
   */
  static resolvePreviewPalette(params: {
    adminTheme: 'dark' | 'light';
    current: Record<string, string>;
    defaults?: Record<string, string>;
  }): {
    primary: string;
    background: string;
    foreground: string;
    muted: string;
    card: string;
    accent: string;
  } {
    const { adminTheme, current, defaults } = params;

    const PREVIEW_THEME_FALLBACKS: Record<
      'dark' | 'light',
      Omit<
        { primary: string; background: string; foreground: string; muted: string; card: string; accent: string },
        'primary' | 'accent'
      >
    > = {
      dark: {
        background: '#0f172a',
        foreground: '#f8fafc',
        muted: '#94a3b8',
        card: '#111827',
      },
      light: {
        background: '#ffffff',
        foreground: '#0f172a',
        muted: '#64748b',
        card: '#f8fafc',
      },
    };

    const DEFAULT_PREVIEW_PRIMARY = '#6366f1';
    const themeFallbacks = PREVIEW_THEME_FALLBACKS[adminTheme];

    const primary =
      ThemePreviewUtils.toNonEmptyString(current.primary) ||
      ThemePreviewUtils.toNonEmptyString(defaults?.primary) ||
      DEFAULT_PREVIEW_PRIMARY;

    const background =
      ThemePreviewUtils.toNonEmptyString(current.background) ||
      ThemePreviewUtils.toNonEmptyString(defaults?.background) ||
      themeFallbacks.background;

    const foreground =
      ThemePreviewUtils.toNonEmptyString(current.foreground) ||
      ThemePreviewUtils.toNonEmptyString(defaults?.foreground) ||
      themeFallbacks.foreground;

    const muted =
      ThemePreviewUtils.toNonEmptyString(current.muted) ||
      ThemePreviewUtils.toNonEmptyString(defaults?.muted) ||
      themeFallbacks.muted;

    const card =
      ThemePreviewUtils.toNonEmptyString(current.card) ||
      ThemePreviewUtils.toNonEmptyString(defaults?.card) ||
      themeFallbacks.card;

    const accent =
      ThemePreviewUtils.toNonEmptyString(current.accent) ||
      ThemePreviewUtils.toNonEmptyString(defaults?.accent) ||
      primary;

    return { primary, background, foreground, muted, card, accent };
  }
}
