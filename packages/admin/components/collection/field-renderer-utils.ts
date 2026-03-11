/**
 * Utility class for field rendering operations.
 * Handles text resolution from localized or complex field values.
 */
export class FieldRendererUtils {
  /**
   * Resolves a renderable text string from a potentially complex value.
   * Handles localized objects, nested structures, and fallback resolution.
   * 
   * @param value - The field value (can be string, object, array)
   * @param preferredLocale - Preferred locale code (e.g., 'en', 'bg')
   * @returns Resolved text string
   * 
   * @example
   * const text = FieldRendererUtils.resolveRenderableText({ en: 'Hello', bg: 'Здравей' }, 'en'); // "Hello"
   * const fallback = FieldRendererUtils.resolveRenderableText({ default: 'Fallback' }); // "Fallback"
   * const simple = FieldRendererUtils.resolveRenderableText('Direct text'); // "Direct text"
   */
  static resolveRenderableText(value: any, preferredLocale?: string): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();

    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = FieldRendererUtils.resolveRenderableText(item, preferredLocale);
        if (resolved) return resolved;
      }
      return '';
    }

    if (typeof value === 'object') {
      // Try preferred locale first
      if (preferredLocale) {
        const direct = FieldRendererUtils.resolveRenderableText(value?.[preferredLocale], preferredLocale);
        if (direct) return direct;
      }

      // Try common keys
      for (const key of ['default', 'value', 'label', 'text', 'description']) {
        const resolved = FieldRendererUtils.resolveRenderableText(value?.[key], preferredLocale);
        if (resolved) return resolved;
      }

      // Fallback: try all nested values
      for (const nestedValue of Object.values(value)) {
        const resolved = FieldRendererUtils.resolveRenderableText(nestedValue, preferredLocale);
        if (resolved) return resolved;
      }
    }

    return '';
  }
}
