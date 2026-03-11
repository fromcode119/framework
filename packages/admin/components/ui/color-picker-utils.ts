/**
 * Utility class for color picker operations.
 * Handles color value coercion and hex normalization.
 */
export class ColorPickerUtils {
  /**
   * Coerces a value to a color string, handling localized color objects.
   * 
   * @param value - Value to coerce (can be string, localized object)
   * @returns Coerced color string
   * 
   * @example
   * const color = ColorPickerUtils.coerceColorValue('#ff0000'); // "#ff0000"
   * const localized = ColorPickerUtils.coerceColorValue({ en: '#00ff00' }); // "#00ff00"
   */
  static coerceColorValue(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
      const localized = value as Record<string, unknown>;
      for (const key of Object.keys(localized)) {
        const candidate = localized[key];
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
      }
    }
    return '';
  }

  /**
   * Normalizes a hex color value by ensuring # prefix.
   * 
   * @param value - Hex color value (with or without #)
   * @returns Normalized hex color with # prefix
   * 
   * @example
   * const hex = ColorPickerUtils.normalizeHexColor('ff0000'); // "#ff0000"
   * const withPrefix = ColorPickerUtils.normalizeHexColor('#00ff00'); // "#00ff00"
   * const short = ColorPickerUtils.normalizeHexColor('fff'); // "#fff"
   */
  static normalizeHexColor(value: string): string {
    if (!value) return '';
    const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
    const match = value.match(HEX_COLOR_PATTERN);
    if (!match) return '';
    return value.startsWith('#') ? value : `#${value}`;
  }
}
