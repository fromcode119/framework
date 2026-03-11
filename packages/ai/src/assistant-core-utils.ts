/**
 * Utility methods for working with assistant actions and data.
 */
export class AssistantCoreUtils {
  /** Produce a compact, human-readable description of any action field value. */
  static describeActionValue(value: any): string {
    if (value === null) return 'clear value';
    if (value === undefined) return 'set to empty';
    if (typeof value === 'string') {
      const compact = value.replace(/\s+/g, ' ').trim();
      if (!compact) return 'set to empty text';
      return compact.length > 90 ? `${compact.slice(0, 89)}...` : compact;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `update list (${value.length})`;
    if (typeof value === 'object') return 'update object';
    return String(value);
  }

  /** Summarise a field-level patch into a label list and short preview pairs. */
  static summarizeFieldPatch(patch: Record<string, any>): {
    fields: string[];
    previews: Array<{ field: string; value: string }>;
  } {
    const entries = Object.entries(patch || {}).filter(([key]) => String(key || '').trim());
    const fields = entries.map(([key]) => key);
    const previews = entries.slice(0, 4).map(([field, value]) => ({
      field,
      value: AssistantCoreUtils.describeActionValue(value),
    }));
    return { fields, previews };
  }

  /** Resolve a human-readable target string from a tool-call input object. */
  static resolveActionTarget(input: Record<string, any>): string {
    const collection = String(input?.collectionSlug || input?.slug || '').trim();
    const selector = String(
      input?.id ?? input?.recordId ?? input?.entrySlug ?? input?.lookupSlug ?? input?.slugValue ?? input?.permalink ?? input?.path ?? ''
    ).trim();
    if (collection && selector) return `${collection} • ${selector}`;
    if (collection) return collection;
    if (selector) return selector;
    return 'selected target';
  }
}
