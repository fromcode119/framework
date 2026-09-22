import { FieldWidth } from '@fromcode119/core/client';

/**
 * Utility class for field rendering operations.
 * Handles text resolution from localized or complex field values.
 */
export class FieldRendererUtils {
  /**
   * Coerces a boolean-field value (which may arrive as a real boolean, the strings
   * `'true'`/`'false'`, or `1`/`0`) into a strict boolean for the toggle control,
   * falling back to the field's default when the value is unset.
   */
  static toBooleanValue(value: any, defaultValue?: any): boolean {
    const candidate = value === undefined || value === null || value === '' ? defaultValue : value;
    return candidate === true || candidate === 'true' || candidate === 1 || candidate === '1';
  }

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

  /**
   * The outer wrapper className for a rendered field: the col-span rule, and nothing else.
   *
   * It used to add a framed box for every READ-ONLY field, which drew an outline inside the
   * section's card for each locked value — and a second one inside that for a control which already
   * draws its own panel. Locked reads as locked without it: the field carries its own "Unlock edit"
   * control and the input renders disabled.
   */
  static wrapperClassName(field: any): string {
    const colSpan =
      field.type === 'textarea' ||
      field.type === 'richText' ||
      field.type === 'array' ||
      (field.type === 'relationship' && field.hasMany) ||
      field.type === 'json' ||
      FieldWidth.resolve(field.admin?.width) === FieldWidth.FULL ||
      field.admin?.component === 'TagField' ||
      field.admin?.component === 'Tags'
        ? 'col-span-full' : '';

    // No box around a read-only field. It used to get `rounded-xl border bg-slate-50/70 p-2.5`,
    // which put a frame inside the section's card for every locked value on the screen — a page of
    // nested outlines. Locked already reads as locked without one: the field carries its own
    // "Unlock edit" control and the input renders disabled.
    return `w-full ${colSpan}`.trim();
  }
}
